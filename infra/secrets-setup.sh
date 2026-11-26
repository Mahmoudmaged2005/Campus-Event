#!/usr/bin/env bash
set -e

INFRA_FOLDER="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$INFRA_FOLDER/../backend/.env"

read_env_value() {
  grep "^$1=" "$ENV_FILE" | head -1 | sed "s/^$1=//; s/^\"//; s/\"$//; s/\r$//"
}

save_secret() {
  SECRET_NAME="$1"
  SECRET_VALUE="$2"
  DESCRIPTION="$3"
  if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" >/dev/null 2>&1; then
    echo "Updating secret $SECRET_NAME"
    aws secretsmanager put-secret-value --secret-id "$SECRET_NAME" --secret-string "$SECRET_VALUE" >/dev/null
  else
    echo "Creating secret $SECRET_NAME"
    aws secretsmanager create-secret --name "$SECRET_NAME" --description "$DESCRIPTION" \
      --secret-string "$SECRET_VALUE" >/dev/null
  fi
}

DATABASE_URL=$(read_env_value DATABASE_URL)
if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is missing in backend/.env"
  exit 1
fi
save_secret campus-events/database-url "$DATABASE_URL" "Neon database address for the Campus Events Lambdas"

EMAIL_APP_PASSWORD=$(read_env_value EMAIL_APP_PASSWORD)
if [ -z "$EMAIL_APP_PASSWORD" ]; then
  echo "EMAIL_APP_PASSWORD is missing in backend/.env, the deployed app will not send emails"
else
  save_secret campus-events/email-app-password "$EMAIL_APP_PASSWORD" "Gmail app password for Campus Events emails"
fi

echo "Done. The secrets are stored in Secrets Manager."
