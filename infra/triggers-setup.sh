#!/usr/bin/env bash
set -e

REGION="${AWS_DEFAULT_REGION:-eu-central-1}"
ACCOUNT="000000000000"
MAX_TRIES=3

queue_url() {
  aws sqs get-queue-url --queue-name "$1" --query QueueUrl --output text
}

queue_arn() {
  echo "arn:aws:sqs:$REGION:$ACCOUNT:$1"
}

add_failed_messages_queue() {
  QUEUE_NAME="$1"
  FAILED_QUEUE_NAME="$QUEUE_NAME-failed"
  echo "Creating $FAILED_QUEUE_NAME for messages that fail $MAX_TRIES times"
  aws sqs create-queue --queue-name "$FAILED_QUEUE_NAME" >/dev/null
  FAILED_QUEUE_ARN=$(queue_arn "$FAILED_QUEUE_NAME")
  REDRIVE_POLICY="{\\\"deadLetterTargetArn\\\":\\\"$FAILED_QUEUE_ARN\\\",\\\"maxReceiveCount\\\":\\\"$MAX_TRIES\\\"}"
  aws sqs set-queue-attributes --queue-url "$(queue_url "$QUEUE_NAME")" \
    --attributes "{\"RedrivePolicy\":\"$REDRIVE_POLICY\",\"VisibilityTimeout\":\"60\"}"
}

connect_queue_to_function() {
  QUEUE_NAME="$1"
  FUNCTION_NAME="$2"
  QUEUE_ARN=$(queue_arn "$QUEUE_NAME")
  EXISTING=$(aws lambda list-event-source-mappings --function-name "$FUNCTION_NAME" \
    --event-source-arn "$QUEUE_ARN" --query 'EventSourceMappings[0].UUID' --output text)
  if [ "$EXISTING" != "None" ] && [ -n "$EXISTING" ]; then
    echo "$QUEUE_NAME is already connected to $FUNCTION_NAME"
    return
  fi
  echo "Connecting $QUEUE_NAME to $FUNCTION_NAME"
  aws lambda create-event-source-mapping --function-name "$FUNCTION_NAME" \
    --event-source-arn "$QUEUE_ARN" --batch-size 10 >/dev/null
}

add_failed_messages_queue student-queue
add_failed_messages_queue notifications-queue

connect_queue_to_function student-queue campus-student-queue
connect_queue_to_function notifications-queue campus-notifications-queue

echo "Done. Queue triggers:"
aws lambda list-event-source-mappings --query 'EventSourceMappings[].[EventSourceArn,FunctionArn,State]' --output text
