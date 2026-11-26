#!/usr/bin/env bash
set -e

ROLE_NAME="campus-events-lambda-role"
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

PERMISSIONS_POLICY="{
  \"Version\": \"2012-10-17\",
  \"Statement\": [
    {
      \"Sid\": \"WriteLogs\",
      \"Effect\": \"Allow\",
      \"Action\": [\"logs:CreateLogGroup\", \"logs:CreateLogStream\", \"logs:PutLogEvents\"],
      \"Resource\": \"arn:aws:logs:$REGION:$ACCOUNT:*\"
    },
    {
      \"Sid\": \"SendEventMessages\",
      \"Effect\": \"Allow\",
      \"Action\": \"sns:Publish\",
      \"Resource\": \"arn:aws:sns:$REGION:$ACCOUNT:campus-events\"
    },
    {
      \"Sid\": \"ReadOwnQueues\",
      \"Effect\": \"Allow\",
      \"Action\": [\"sqs:ReceiveMessage\", \"sqs:DeleteMessage\", \"sqs:GetQueueAttributes\"],
      \"Resource\": [
        \"arn:aws:sqs:$REGION:$ACCOUNT:student-queue\",
        \"arn:aws:sqs:$REGION:$ACCOUNT:notifications-queue\"
      ]
    },
    {
      \"Sid\": \"SaveAndDeletePosters\",
      \"Effect\": \"Allow\",
      \"Action\": [\"s3:PutObject\", \"s3:DeleteObject\"],
      \"Resource\": \"arn:aws:s3:::$BUCKET/events/*\"
    }
  ]
}"

echo "Creating role $ROLE_NAME"
if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  echo "Role already exists"
else
  aws iam create-role --role-name "$ROLE_NAME" --assume-role-policy-document "$TRUST_POLICY" >/dev/null
fi

echo "Giving the role only the permissions the Lambdas need"
aws iam put-role-policy --role-name "$ROLE_NAME" --policy-name campus-events-lambda-permissions \
  --policy-document "$PERMISSIONS_POLICY"

ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query Role.Arn --output text)
echo "Done. Role: $ROLE_ARN"
