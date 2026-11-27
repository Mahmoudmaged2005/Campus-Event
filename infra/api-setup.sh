#!/usr/bin/env bash
set -e

API_NAME="campus-events-api"
STAGE="prod"
REGION="${AWS_DEFAULT_REGION:-eu-central-1}"
ACCOUNT="000000000000"
WEBSITE="http://localhost:5173"
FUNCTION_ARN_START="arn:aws:lambda:$REGION:$ACCOUNT:function"

OLD_API_ID=$(aws apigateway get-rest-apis --query "items[?name=='$API_NAME'].id | [0]" --output text)
if [ "$OLD_API_ID" != "None" ] && [ -n "$OLD_API_ID" ]; then
  echo "Removing the old API $OLD_API_ID so it can be built again"
  aws apigateway delete-rest-api --rest-api-id "$OLD_API_ID"
fi

echo "Creating REST API $API_NAME"
API_ID=$(aws apigateway create-rest-api --name "$API_NAME" \
  --binary-media-types "multipart/form-data" "image/*" \
  --query id --output text)
ROOT_ID=$(aws apigateway get-resources --rest-api-id "$API_ID" --query "items[?path=='/'].id | [0]" --output text)
API_RESOURCE_ID=$(aws apigateway create-resource --rest-api-id "$API_ID" --parent-id "$ROOT_ID" --path-part api --query id --output text)

echo "Creating the login guard (Lambda authorizer campus-authorizer)"
AUTHORIZER_ID=$(aws apigateway create-authorizer --rest-api-id "$API_ID" --name campus-login-guard \
  --type TOKEN --identity-source method.request.header.Authorization \
  --authorizer-uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$FUNCTION_ARN_START:campus-authorizer/invocations" \
  --authorizer-result-ttl-in-seconds 0 --query id --output text)

allow_gateway_to_call() {
  local FUNCTION_NAME="$1"
  aws lambda add-permission --function-name "$FUNCTION_NAME" \
    --statement-id "allow-api-gateway" --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$REGION:$ACCOUNT:$API_ID/*" >/dev/null 2>&1 || true
}

send_method_to_lambda() {
  local RESOURCE_ID="$1"
  local HTTP_METHOD="$2"
  local FUNCTION_NAME="$3"
  local GUARD="$4"
  if [ "$GUARD" = "guarded" ]; then
    aws apigateway put-method --rest-api-id "$API_ID" --resource-id "$RESOURCE_ID" \
      --http-method "$HTTP_METHOD" --authorization-type CUSTOM --authorizer-id "$AUTHORIZER_ID" >/dev/null
  else
    aws apigateway put-method --rest-api-id "$API_ID" --resource-id "$RESOURCE_ID" \
      --http-method "$HTTP_METHOD" --authorization-type NONE >/dev/null
  fi
  aws apigateway put-integration --rest-api-id "$API_ID" --resource-id "$RESOURCE_ID" \
    --http-method "$HTTP_METHOD" --type AWS_PROXY --integration-http-method POST \
    --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$FUNCTION_ARN_START:$FUNCTION_NAME/invocations" >/dev/null
}

add_module_route() {
  local PATH_PART="$1"
  local FUNCTION_NAME="$2"
  local GUARD="$3"
  echo "Sending /api/$PATH_PART to $FUNCTION_NAME ($GUARD)"
  local MODULE_RESOURCE_ID=$(aws apigateway create-resource --rest-api-id "$API_ID" --parent-id "$API_RESOURCE_ID" --path-part "$PATH_PART" --query id --output text)
  local PROXY_RESOURCE_ID=$(aws apigateway create-resource --rest-api-id "$API_ID" --parent-id "$MODULE_RESOURCE_ID" --path-part "{proxy+}" --query id --output text)
  local ONE_RESOURCE_ID
  for ONE_RESOURCE_ID in "$MODULE_RESOURCE_ID" "$PROXY_RESOURCE_ID"; do
    send_method_to_lambda "$ONE_RESOURCE_ID" ANY "$FUNCTION_NAME" "$GUARD"
    send_method_to_lambda "$ONE_RESOURCE_ID" OPTIONS "$FUNCTION_NAME" open
  done
  allow_gateway_to_call "$FUNCTION_NAME"
}

answer_like_our_api() {
  local RESPONSE_TYPE="$1"
  local MESSAGE="$2"
  aws apigateway put-gateway-response --rest-api-id "$API_ID" --response-type "$RESPONSE_TYPE" \
    --response-parameters "{\"gatewayresponse.header.Access-Control-Allow-Origin\":\"'$WEBSITE'\"}" \
    --response-templates "{\"application/json\":\"{\\\"error\\\":\\\"$MESSAGE\\\"}\"}" >/dev/null
}

add_module_route health campus-auth open
add_module_route auth campus-auth open
add_module_route events campus-events guarded
add_module_route admin campus-admin guarded
add_module_route student campus-student guarded
add_module_route notifications campus-notifications guarded
allow_gateway_to_call campus-authorizer

echo "Making the guard answer with our normal error format"
answer_like_our_api UNAUTHORIZED "Please log in first"
answer_like_our_api ACCESS_DENIED "Your session has ended, please log in again"

echo "Publishing the API to stage $STAGE"
aws apigateway create-deployment --rest-api-id "$API_ID" --stage-name "$STAGE" >/dev/null

echo "Done. API address: http://localhost:4566/restapis/$API_ID/$STAGE/_user_request_/api"
echo "Run bash infra/frontend-setup.sh so the website uses the new address."
