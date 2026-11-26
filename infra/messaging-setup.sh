#!/usr/bin/env bash
set -e

REGION="${AWS_DEFAULT_REGION:-eu-central-1}"
TOPIC_NAME="campus-events"

echo "Creating SNS topic $TOPIC_NAME"
TOPIC_ARN=$(aws sns create-topic --name "$TOPIC_NAME" --region "$REGION" --query TopicArn --output text)
echo "Topic: $TOPIC_ARN"

create_queue_and_subscribe() {
  QUEUE_NAME="$1"
  MESSAGE_TYPES="$2"

  echo "Creating SQS queue $QUEUE_NAME"
  QUEUE_URL=$(aws sqs create-queue --queue-name "$QUEUE_NAME" --region "$REGION" --query QueueUrl --output text)
  QUEUE_ARN=$(aws sqs get-queue-attributes --queue-url "$QUEUE_URL" --attribute-names QueueArn --region "$REGION" --query Attributes.QueueArn --output text)

  echo "Allowing the topic to send to $QUEUE_NAME"
  POLICY="{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"Service\":\"sns.amazonaws.com\"},\"Action\":\"sqs:SendMessage\",\"Resource\":\"$QUEUE_ARN\",\"Condition\":{\"ArnEquals\":{\"aws:SourceArn\":\"$TOPIC_ARN\"}}}]}"
  POLICY_ESCAPED=$(echo "$POLICY" | sed 's/"/\\"/g')
  aws sqs set-queue-attributes --queue-url "$QUEUE_URL" --region "$REGION" \
    --attributes "{\"Policy\":\"$POLICY_ESCAPED\"}"

  echo "Subscribing $QUEUE_NAME to: $MESSAGE_TYPES"
  SUBSCRIPTION_ARN=$(aws sns subscribe --topic-arn "$TOPIC_ARN" --protocol sqs \
    --notification-endpoint "$QUEUE_ARN" --region "$REGION" \
    --return-subscription-arn --query SubscriptionArn --output text)
  aws sns set-subscription-attributes --subscription-arn "$SUBSCRIPTION_ARN" --region "$REGION" \
    --attribute-name RawMessageDelivery --attribute-value true
  aws sns set-subscription-attributes --subscription-arn "$SUBSCRIPTION_ARN" --region "$REGION" \
    --attribute-name FilterPolicy --attribute-value "{\"type\":[$MESSAGE_TYPES]}"
}

create_queue_and_subscribe "student-queue" '"event.cancelled","event.rescheduled"'
create_queue_and_subscribe "notifications-queue" '"event.approved","event.rejected"'

echo "Done. Put this line in backend/.env:"
echo "SNS_TOPIC_ARN=$TOPIC_ARN"
