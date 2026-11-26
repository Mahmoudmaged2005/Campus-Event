#!/usr/bin/env bash
set -e

REGION="${AWS_DEFAULT_REGION:-eu-central-1}"
ACCOUNT="000000000000"
ROLE_NAME="campus-events-scheduler-role"
ROLE_ARN="arn:aws:iam::$ACCOUNT:role/$ROLE_NAME"
FUNCTION_ARN_START="arn:aws:lambda:$REGION:$ACCOUNT:function"

TRUST_POLICY='{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "scheduler.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}'

PERMISSIONS_POLICY="{
  \"Version\": \"2012-10-17\",
  \"Statement\": [{
    \"Sid\": \"StartTheTimedJobs\",
    \"Effect\": \"Allow\",
    \"Action\": \"lambda:InvokeFunction\",
    \"Resource\": [
      \"$FUNCTION_ARN_START:campus-student-reminders\",
      \"$FUNCTION_ARN_START:campus-student-digest\",
      \"$FUNCTION_ARN_START:campus-admin-lifecycle\"
    ]
  }]
}"

echo "Creating role $ROLE_NAME so the scheduler may start the timed jobs"
if ! aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  aws iam create-role --role-name "$ROLE_NAME" --assume-role-policy-document "$TRUST_POLICY" >/dev/null
fi
aws iam put-role-policy --role-name "$ROLE_NAME" --policy-name campus-events-scheduler-permissions \
  --policy-document "$PERMISSIONS_POLICY"

schedule_function() {
  SCHEDULE_NAME="$1"
  SCHEDULE="$2"
  FUNCTION_NAME="$3"
  TARGET="Arn=$FUNCTION_ARN_START:$FUNCTION_NAME,RoleArn=$ROLE_ARN"

  if aws scheduler get-schedule --name "$SCHEDULE_NAME" >/dev/null 2>&1; then
    echo "Updating $SCHEDULE_NAME: $FUNCTION_NAME on $SCHEDULE"
    COMMAND="update-schedule"
  else
    echo "Creating $SCHEDULE_NAME: $FUNCTION_NAME on $SCHEDULE"
    COMMAND="create-schedule"
  fi
  aws scheduler "$COMMAND" --name "$SCHEDULE_NAME" \
    --schedule-expression "$SCHEDULE" --schedule-expression-timezone "Africa/Cairo" \
    --flexible-time-window Mode=OFF --target "$TARGET" >/dev/null
}

schedule_function campus-send-reminders "rate(5 minutes)" campus-student-reminders
schedule_function campus-complete-past-events "rate(1 hour)" campus-admin-lifecycle
schedule_function campus-weekly-digest "cron(0 8 ? * SUN *)" campus-student-digest

echo "Done. Schedules:"
aws scheduler list-schedules --query 'Schedules[].[Name,State]' --output text
