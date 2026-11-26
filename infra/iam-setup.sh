#!/usr/bin/env bash
set -e

BUCKET="${S3_BUCKET:-campus-events-images}"
REGION="${AWS_DEFAULT_REGION:-eu-central-1}"
ACCOUNT="000000000000"

TRUST_POLICY='{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "lambda.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}'

SEND_MESSAGES="{
  \"Sid\": \"SendEventMessages\",
  \"Effect\": \"Allow\",
  \"Action\": \"sns:Publish\",
  \"Resource\": \"arn:aws:sns:$REGION:$ACCOUNT:campus-events\"
}"

SAVE_POSTERS="{
  \"Sid\": \"SaveAndDeletePosters\",
  \"Effect\": \"Allow\",
  \"Action\": [\"s3:PutObject\", \"s3:DeleteObject\"],
  \"Resource\": \"arn:aws:s3:::$BUCKET/events/*\"
}"

write_logs() {
  FUNCTION_NAME="$1"
  echo "{
    \"Sid\": \"WriteOwnLogs\",
    \"Effect\": \"Allow\",
    \"Action\": [\"logs:CreateLogGroup\", \"logs:CreateLogStream\", \"logs:PutLogEvents\"],
    \"Resource\": \"arn:aws:logs:$REGION:$ACCOUNT:log-group:/aws/lambda/$FUNCTION_NAME:*\"
  }"
}

read_queue() {
  QUEUE_NAME="$1"
  echo "{
    \"Sid\": \"ReadOwnQueue\",
    \"Effect\": \"Allow\",
    \"Action\": [\"sqs:ReceiveMessage\", \"sqs:DeleteMessage\", \"sqs:GetQueueAttributes\"],
    \"Resource\": \"arn:aws:sqs:$REGION:$ACCOUNT:$QUEUE_NAME\"
  }"
}

create_role_for_function() {
  FUNCTION_NAME="$1"
  EXTRA_STATEMENTS="$2"
  ROLE_NAME="$FUNCTION_NAME-role"

  STATEMENTS="$(write_logs "$FUNCTION_NAME")"
  if [ -n "$EXTRA_STATEMENTS" ]; then
    STATEMENTS="$STATEMENTS, $EXTRA_STATEMENTS"
  fi
  POLICY="{ \"Version\": \"2012-10-17\", \"Statement\": [ $STATEMENTS ] }"

  echo "Role $ROLE_NAME"
  if ! aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
    aws iam create-role --role-name "$ROLE_NAME" --assume-role-policy-document "$TRUST_POLICY" >/dev/null
  fi
  aws iam put-role-policy --role-name "$ROLE_NAME" --policy-name "$FUNCTION_NAME-permissions" \
    --policy-document "$POLICY"
}

create_role_for_function campus-auth ""
create_role_for_function campus-events "$SEND_MESSAGES, $SAVE_POSTERS"
create_role_for_function campus-admin "$SEND_MESSAGES"
create_role_for_function campus-admin-lifecycle ""
create_role_for_function campus-student ""
create_role_for_function campus-student-queue "$(read_queue student-queue)"
create_role_for_function campus-student-reminders ""
create_role_for_function campus-student-digest ""
create_role_for_function campus-notifications ""
create_role_for_function campus-notifications-queue "$(read_queue notifications-queue)"

echo "Done. Every Lambda has its own role with only the permissions it needs."
