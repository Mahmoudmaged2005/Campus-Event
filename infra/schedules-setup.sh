#!/usr/bin/env bash
set -e

REGION="${AWS_DEFAULT_REGION:-eu-central-1}"
ACCOUNT="000000000000"

schedule_function() {
  RULE_NAME="$1"
  SCHEDULE="$2"
  FUNCTION_NAME="$3"
  FUNCTION_ARN="arn:aws:lambda:$REGION:$ACCOUNT:function:$FUNCTION_NAME"

  echo "Rule $RULE_NAME runs $FUNCTION_NAME on $SCHEDULE"
  aws events put-rule --name "$RULE_NAME" --schedule-expression "$SCHEDULE" --state ENABLED >/dev/null
  aws events put-targets --rule "$RULE_NAME" --targets "Id=1,Arn=$FUNCTION_ARN" >/dev/null
  aws lambda add-permission --function-name "$FUNCTION_NAME" \
    --statement-id "allow-$RULE_NAME" --action lambda:InvokeFunction \
    --principal events.amazonaws.com \
    --source-arn "arn:aws:events:$REGION:$ACCOUNT:rule/$RULE_NAME" >/dev/null 2>&1 || true
}

schedule_function campus-send-reminders "rate(5 minutes)" campus-student-reminders
schedule_function campus-complete-past-events "rate(1 hour)" campus-admin-lifecycle
schedule_function campus-weekly-digest "cron(0 6 ? * SUN *)" campus-student-digest

echo "Done. Schedules:"
aws events list-rules --name-prefix campus- --query 'Rules[].[Name,ScheduleExpression,State]' --output text
