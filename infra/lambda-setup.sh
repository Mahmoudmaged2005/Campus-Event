#!/usr/bin/env bash
set -e

INFRA_FOLDER="$(cd "$(dirname "$0")" && pwd)"
DIST_FOLDER="$INFRA_FOLDER/../backend/dist"
REGION="${AWS_DEFAULT_REGION:-eu-central-1}"
ROLE_ARN_START="arn:aws:iam::000000000000:role"
FLOCI_INSIDE_DOCKER="http://campus-events-floci:4566"
BUCKET="${S3_BUCKET:-campus-events-images}"
ENV_FILE="$INFRA_FOLDER/../backend/.env"
EMAIL_USER=$(grep "^EMAIL_USER=" "$ENV_FILE" | head -1 | sed 's/^EMAIL_USER=//; s/^"//; s/"$//; s/\r$//')

cd "$DIST_FOLDER"
SETTINGS_FILE="lambda-settings.json"
cat > "$SETTINGS_FILE" <<EOF
{
  "Variables": {
    "DATABASE_SECRET_NAME": "campus-events/database-url",
    "EMAIL_USER": "$EMAIL_USER",
    "EMAIL_SECRET_NAME": "campus-events/email-app-password",
    "SECRETS_ENDPOINT": "$FLOCI_INSIDE_DOCKER",
    "CORS_ORIGINS": "http://localhost:5173",
    "S3_ENDPOINT": "$FLOCI_INSIDE_DOCKER",
    "S3_BUCKET": "$BUCKET",
    "S3_PUBLIC_URL": "http://localhost:4566/$BUCKET",
    "SNS_ENDPOINT": "$FLOCI_INSIDE_DOCKER",
    "SNS_TOPIC_ARN": "arn:aws:sns:$REGION:000000000000:campus-events"
  }
}
EOF

create_or_update_function() {
  FUNCTION_NAME="$1"
  ZIP_NAME="$2"
  HANDLER="$3"
  ZIP_FILE="$ZIP_NAME.zip"
  ROLE_ARN="$ROLE_ARN_START/$FUNCTION_NAME-role"

  if aws lambda get-function --function-name "$FUNCTION_NAME" >/dev/null 2>&1; then
    echo "Updating $FUNCTION_NAME"
    aws lambda update-function-code --function-name "$FUNCTION_NAME" --zip-file "fileb://$ZIP_FILE" >/dev/null
    aws lambda wait function-updated --function-name "$FUNCTION_NAME"
    aws lambda update-function-configuration --function-name "$FUNCTION_NAME" \
      --role "$ROLE_ARN" --handler "$HANDLER" --environment "file://$SETTINGS_FILE" >/dev/null
  else
    echo "Creating $FUNCTION_NAME"
    aws lambda create-function --function-name "$FUNCTION_NAME" \
      --runtime nodejs22.x --role "$ROLE_ARN" --handler "$HANDLER" \
      --zip-file "fileb://$ZIP_FILE" --timeout 30 --memory-size 512 \
      --environment "file://$SETTINGS_FILE" >/dev/null
  fi
}

create_or_update_function campus-auth auth index.handler
create_or_update_function campus-events events index.handler
create_or_update_function campus-admin admin index.handler
create_or_update_function campus-admin-lifecycle admin index.lifecycleHandler
create_or_update_function campus-student student index.handler
create_or_update_function campus-student-queue student index.studentQueueHandler
create_or_update_function campus-student-reminders student index.remindersHandler
create_or_update_function campus-student-digest student index.digestHandler
create_or_update_function campus-notifications notifications index.handler
create_or_update_function campus-notifications-queue notifications index.notificationsQueueHandler

rm "$SETTINGS_FILE"
echo "Done. Lambda functions:"
aws lambda list-functions --query 'Functions[].FunctionName' --output text
