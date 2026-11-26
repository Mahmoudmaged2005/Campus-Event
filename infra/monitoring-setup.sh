#!/usr/bin/env bash
set -e

REGION="${AWS_DEFAULT_REGION:-eu-central-1}"
ALERTS_TOPIC_NAME="campus-alerts"
FIVE_MINUTES=300

FUNCTION_NAMES="campus-auth campus-events campus-admin campus-admin-lifecycle campus-student campus-student-queue campus-student-reminders campus-student-digest campus-notifications campus-notifications-queue"
FAILED_QUEUE_NAMES="student-queue-failed notifications-queue-failed"

echo "Creating SNS topic $ALERTS_TOPIC_NAME for alarm messages"
ALERTS_TOPIC_ARN=$(aws sns create-topic --name "$ALERTS_TOPIC_NAME" --region "$REGION" --query TopicArn --output text)
echo "Alerts topic: $ALERTS_TOPIC_ARN"

ALERT_EMAIL="${ALERT_EMAIL:-team@example.com}"
echo "Sending alarm messages to $ALERT_EMAIL"
aws sns subscribe --region "$REGION" --topic-arn "$ALERTS_TOPIC_ARN" \
  --protocol email --notification-endpoint "$ALERT_EMAIL" >/dev/null

alarm_on_failed_queue() {
  QUEUE_NAME="$1"
  ALARM_NAME="campus-$QUEUE_NAME-has-messages"
  echo "Alarm $ALARM_NAME: messages waiting in $QUEUE_NAME"
  aws cloudwatch put-metric-alarm --region "$REGION" \
    --alarm-name "$ALARM_NAME" \
    --alarm-description "A message failed 3 times and is waiting in $QUEUE_NAME" \
    --namespace AWS/SQS --metric-name ApproximateNumberOfMessagesVisible \
    --dimensions "Name=QueueName,Value=$QUEUE_NAME" \
    --statistic Maximum --period "$FIVE_MINUTES" --evaluation-periods 1 \
    --threshold 0 --comparison-operator GreaterThanThreshold \
    --treat-missing-data notBreaching \
    --alarm-actions "$ALERTS_TOPIC_ARN"
}

alarm_on_function_errors() {
  FUNCTION_NAME="$1"
  ALARM_NAME="$FUNCTION_NAME-errors"
  echo "Alarm $ALARM_NAME: errors in $FUNCTION_NAME"
  aws cloudwatch put-metric-alarm --region "$REGION" \
    --alarm-name "$ALARM_NAME" \
    --alarm-description "The Lambda $FUNCTION_NAME had an error in the last 5 minutes" \
    --namespace AWS/Lambda --metric-name Errors \
    --dimensions "Name=FunctionName,Value=$FUNCTION_NAME" \
    --statistic Sum --period "$FIVE_MINUTES" --evaluation-periods 1 \
    --threshold 0 --comparison-operator GreaterThanThreshold \
    --treat-missing-data notBreaching \
    --alarm-actions "$ALERTS_TOPIC_ARN"
}

for QUEUE_NAME in $FAILED_QUEUE_NAMES; do
  alarm_on_failed_queue "$QUEUE_NAME"
done

for FUNCTION_NAME in $FUNCTION_NAMES; do
  alarm_on_function_errors "$FUNCTION_NAME"
done

echo "Done. Alarms:"
aws cloudwatch describe-alarms --region "$REGION" --alarm-name-prefix campus- \
  --query 'MetricAlarms[].[AlarmName,StateValue]' --output text
