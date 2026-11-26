#!/usr/bin/env bash
set -e

API_NAME="campus-events-api"
STAGE="prod"
REGION="${AWS_DEFAULT_REGION:-eu-central-1}"
ACCOUNT="000000000000"

EXISTING_API_ID=$(aws apigateway get-rest-apis --query "items[?name=='$API_NAME'].id | [0]" --output text)
if [ "$EXISTING_API_ID" != "None" ] && [ -n "$EXISTING_API_ID" ]; then
  echo "API already exists, nothing to do."
  echo "API address: http://localhost:4566/restapis/$EXISTING_API_ID/$STAGE/_user_request_/api"
  exit 0
fi

echo "Creating REST API $API_NAME"
API_ID=$(aws apigateway create-rest-api --name "$API_NAME" \
  --binary-media-types "multipart/form-data" "image/*" \
  --query id --output text)
ROOT_ID=$(aws apigateway get-resources --rest-api-id "$API_ID" --query "items[?path=='/'].id | [0]" --output text)
API_RESOURCE_ID=$(aws apigateway create-resource --rest-api-id "$API_ID" --parent-id "$ROOT_ID" --path-part api --query id --output text)

send_to_lambda() {
  RESOURCE_ID="$1"
  FUNCTION_NAME="$2"
  FUNCTION_ARN="arn:aws:lambda:$REGION:$ACCOUNT:function:$FUNCTION_NAME"
  aws apigateway put-method --rest-api-id "$API_ID" --resource-id "$RESOURCE_ID" \
    --http-method ANY --authorization-type NONE >/dev/null
  aws apigateway put-integration --rest-api-id "$API_ID" --resource-id "$RESOURCE_ID" \
    --http-method ANY --type AWS_PROXY --integration-http-method POST \
    --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$FUNCTION_ARN/invocations" >/dev/null
}

allow_gateway_to_call() {
  FUNCTION_NAME="$1"
  aws lambda add-permission --function-name "$FUNCTION_NAME" \
    --statement-id "allow-api-gateway" --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$REGION:$ACCOUNT:$API_ID/*" >/dev/null 2>&1 || true
}

add_module_route() {
  PATH_PART="$1"
  FUNCTION_NAME="$2"
  echo "Sending /api/$PATH_PART to $FUNCTION_NAME"
  MODULE_RESOURCE_ID=$(aws apigateway create-resource --rest-api-id "$API_ID" --parent-id "$API_RESOURCE_ID" --path-part "$PATH_PART" --query id --output text)
  PROXY_RESOURCE_ID=$(aws apigateway create-resource --rest-api-id "$API_ID" --parent-id "$MODULE_RESOURCE_ID" --path-part "{proxy+}" --query id --output text)
  send_to_lambda "$MODULE_RESOURCE_ID" "$FUNCTION_NAME"
  send_to_lambda "$PROXY_RESOURCE_ID" "$FUNCTION_NAME"
  allow_gateway_to_call "$FUNCTION_NAME"
}

add_module_route health campus-auth
add_module_route auth campus-auth
add_module_route events campus-events
add_module_route admin campus-admin
add_module_route student campus-student
add_module_route notifications campus-notifications

echo "Publishing the API to stage $STAGE"
aws apigateway create-deployment --rest-api-id "$API_ID" --stage-name "$STAGE" >/dev/null

echo "Done. API address: http://localhost:4566/restapis/$API_ID/$STAGE/_user_request_/api"
