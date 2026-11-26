#!/usr/bin/env bash
set -e

INFRA_FOLDER="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$INFRA_FOLDER/../backend/.env"
SECRET_NAME="campus-events/database-url"

DATABASE_URL=$(grep "^DATABASE_URL=" "$ENV_FILE" | head -1 | sed 's/^DATABASE_URL=//; s/^"//; s/"$//')
if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is missing in backend/.env"
  exit 1
fi

if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" >/dev/null 2>&1; then
  echo "Updating secret $SECRET_NAME"
  aws secretsmanager put-secret-value --secret-id "$SECRET_NAME" --secret-string "$DATABASE_URL" >/dev/null
else
  echo "Creating secret $SECRET_NAME"
  aws secretsmanager create-secret --name "$SECRET_NAME" \
    --description "Neon database address for the Campus Events Lambdas" \
    --secret-string "$DATABASE_URL" >/dev/null
fi

echo "Done. The database address is stored in Secrets Manager as $SECRET_NAME"
