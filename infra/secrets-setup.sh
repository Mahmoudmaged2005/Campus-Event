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

MAILJET_API_KEY=$(read_env_value MAILJET_API_KEY)
MAILJET_SECRET_KEY=$(read_env_value MAILJET_SECRET_KEY)
if [ -z "$MAILJET_API_KEY" ] || [ -z "$MAILJET_SECRET_KEY" ]; then
  echo "The Mailjet keys are missing in backend/.env, the deployed app will not send emails"
else
  save_secret campus-events/mailjet-api-key "$MAILJET_API_KEY" "Mailjet API key for Campus Events emails"
  save_secret campus-events/mailjet-secret-key "$MAILJET_SECRET_KEY" "Mailjet secret key for Campus Events emails"
fi

echo "Done. The secrets are stored in Secrets Manager."
