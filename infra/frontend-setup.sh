#!/usr/bin/env bash
set -e

INFRA_FOLDER="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_ENV_FILE="$INFRA_FOLDER/../frontend/.env.local"
API_NAME="campus-events-api"
STAGE="prod"

API_ID=$(aws apigateway get-rest-apis --query "items[?name=='$API_NAME'].id | [0]" --output text)
if [ "$API_ID" = "None" ] || [ -z "$API_ID" ]; then
  echo "The API does not exist yet. Run infra/api-setup.sh first."
  exit 1
fi

API_URL="http://localhost:4566/restapis/$API_ID/$STAGE/_user_request_/api"
echo "VITE_API_URL=$API_URL" > "$FRONTEND_ENV_FILE"

echo "Done. The website now uses the deployed backend:"
echo "$API_URL"
echo "Restart the website (npm run dev in frontend) to use it."
echo "To use the local backend again, delete frontend/.env.local"
