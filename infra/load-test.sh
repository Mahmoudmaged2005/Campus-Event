#!/usr/bin/env bash
set -e

INFRA_FOLDER="$(cd "$(dirname "$0")" && pwd)"
cd "$INFRA_FOLDER/.."
source infra/env.sh

API_ID=$(aws apigateway get-rest-apis --query "items[?name=='campus-events-api'].id | [0]" --output text)
API_URL="http://localhost:4566/restapis/$API_ID/prod/_user_request_/api"

K6="k6"
if ! command -v k6 >/dev/null 2>&1; then
  K6="/c/Program Files/k6/k6.exe"
fi

echo "== Raising the rate limit for the test (all fake users share your one IP address)"
RATE_LIMIT_MAX=100000 bash infra/lambda-setup.sh >/dev/null

echo "== Running k6 against $API_URL"
set +e
"$K6" run -e API_URL="$API_URL" k6/load-test.js
K6_RESULT=$?
set -e

echo "== Putting the normal rate limit back"
unset RATE_LIMIT_MAX
bash infra/lambda-setup.sh >/dev/null

exit $K6_RESULT
