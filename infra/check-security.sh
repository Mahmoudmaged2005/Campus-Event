#!/usr/bin/env bash

API_ID=$(aws apigateway get-rest-apis --query "items[?name=='campus-events-api'].id | [0]" --output text)
API="http://localhost:4566/restapis/$API_ID/prod/_user_request_/api"
PASSWORD="${DEMO_PASSWORD:-Password123!}"
ORGANIZER_EMAIL="${ORGANIZER_EMAIL:-demo.organizer@campus.test}"
OTHER_ORGANIZER_EMAIL="${OTHER_ORGANIZER_EMAIL:-organizer2@campus.test}"
STUDENT_EMAIL="${STUDENT_EMAIL:-demo.student@campus.test}"
WORK_FOLDER=$(mktemp -d)
BODY="$WORK_FOLDER/body.txt"
PASSED=0
FAILED=0

check() {
  NAME="$1"
  RESULT="$2"
  if [ "$RESULT" = "yes" ]; then
    echo "  PASS  $NAME"
    PASSED=$((PASSED + 1))
  else
    echo "  FAIL  $NAME"
    FAILED=$((FAILED + 1))
  fi
}

same() {
  if [ "$1" = "$2" ]; then echo yes; else echo no; fi
}

call() {
  METHOD="$1"
  ROUTE="$2"
  TOKEN="$3"
  DATA="$4"
  if [ -n "$DATA" ]; then
    curl -s -m 60 -o "$BODY" -w "%{http_code}" -X "$METHOD" "$API$ROUTE" \
      -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$DATA"
  else
    curl -s -m 60 -o "$BODY" -w "%{http_code}" -X "$METHOD" "$API$ROUTE" -H "Authorization: Bearer $TOKEN"
  fi
}

json_value() {
  python -c "import sys, json; print(json.load(open(sys.argv[1])).get(sys.argv[2], ''))" "$BODY" "$1" 2>/dev/null
}

log_in() {
  call POST /auth/login "" "{\"email\":\"$1\",\"password\":\"$PASSWORD\"}" >/dev/null
  json_value token
}

echo "Security check against $API"
echo
echo "Logging in as the demo accounts"
ORGANIZER_TOKEN=$(log_in "$ORGANIZER_EMAIL")
OTHER_TOKEN=$(log_in "$OTHER_ORGANIZER_EMAIL")
STUDENT_TOKEN=$(log_in "$STUDENT_EMAIL")
if [ -z "$ORGANIZER_TOKEN" ] || [ -z "$OTHER_TOKEN" ] || [ -z "$STUDENT_TOKEN" ]; then
  echo "Could not log in. Check the demo accounts and DEMO_PASSWORD, and wait one minute if you were rate limited."
  exit 1
fi

echo
echo "1. Security headers"
HEADERS=$(curl -s -m 60 -D - -o /dev/null "$API/health" | tr -d '\r' | tr 'A-Z' 'a-z')
check "X-Content-Type-Options: nosniff" "$(echo "$HEADERS" | grep -q '^x-content-type-options: nosniff' && echo yes || echo no)"
check "X-Frame-Options is set" "$(echo "$HEADERS" | grep -q '^x-frame-options:' && echo yes || echo no)"
check "Content-Security-Policy is set" "$(echo "$HEADERS" | grep -q '^content-security-policy:' && echo yes || echo no)"
check "X-Powered-By is hidden" "$(echo "$HEADERS" | grep -q '^x-powered-by:' && echo no || echo yes)"

echo
echo "2. Logins and roles"
check "No login gives 401" "$(same "$(call GET /events/mine "")" 401)"
check "A made-up token gives 401" "$(same "$(call GET /events/mine "0123456789abcdef0123456789abcdef")" 401)"
check "A student cannot create events (403)" "$(same "$(call POST /events "$STUDENT_TOKEN" '{"title":"x"}')" 403)"
check "A student cannot open the admin review queue (403)" "$(same "$(call GET /admin/review-queue "$STUDENT_TOKEN")" 403)"
call GET /auth/me "$ORGANIZER_TOKEN" >/dev/null
check "The password hash is never sent back" "$(grep -qi 'passwordHash' "$BODY" && echo no || echo yes)"

echo
echo "3. Ownership"
EVENT='{"title":"Security Check Event","description":"Made by check-security.sh","location":"Security Check Room","startsAt":"2032-01-10T10:00:00Z","endsAt":"2032-01-10T11:00:00Z","categoryId":1}'
call POST /events "$ORGANIZER_TOKEN" "$EVENT" >/dev/null
EVENT_ID=$(python -c "import sys, json; print(json.load(open(sys.argv[1]))['event']['id'])" "$BODY" 2>/dev/null)
check "Another organizer cannot see my event (404)" "$(same "$(call GET "/events/$EVENT_ID" "$OTHER_TOKEN")" 404)"
check "Another organizer cannot edit my event (404)" "$(same "$(call PATCH "/events/$EVENT_ID" "$OTHER_TOKEN" '{"title":"Taken over"}')" 404)"
check "Another organizer cannot delete my event (404)" "$(same "$(call DELETE "/events/$EVENT_ID" "$OTHER_TOKEN")" 404)"

echo
echo "4. Input checks"
LONG_TITLE=$(printf 'a%.0s' $(seq 1 200))
check "A 200 character title is refused (400)" "$(same "$(call PATCH "/events/$EVENT_ID" "$ORGANIZER_TOKEN" "{\"title\":\"$LONG_TITLE\"}")" 400)"
check "A <script> in the title is refused (400)" "$(same "$(call PATCH "/events/$EVENT_ID" "$ORGANIZER_TOKEN" '{"title":"<script>alert(1)</script>hi"}')" 400)"
check "Broken JSON is refused (400)" "$(same "$(call PATCH "/events/$EVENT_ID" "$ORGANIZER_TOKEN" '{"title": ')" 400)"
check "A login with an SQL trick is refused (400)" "$(same "$(call POST /auth/login "" "{\"email\":\"' OR 1=1 --\",\"password\":\"x\"}")" 400)"
BIG_FILE="$WORK_FOLDER/big.json"
python -c "print('{\"description\":\"' + 'b' * 60000 + '\"}')" > "$BIG_FILE"
BIG_CODE=$(curl -s -m 60 -o /dev/null -w "%{http_code}" -X PATCH "$API/events/$EVENT_ID" \
  -H "Authorization: Bearer $ORGANIZER_TOKEN" -H "Content-Type: application/json" --data-binary "@$BIG_FILE")
check "A body over 50 KB is refused (413)" "$(same "$BIG_CODE" 413)"
call DELETE "/events/$EVENT_ID" "$ORGANIZER_TOKEN" >/dev/null
check "My test event is deleted again" "$(same "$(call GET "/events/$EVENT_ID" "$ORGANIZER_TOKEN")" 404)"

echo
echo "5. Browser origin (CORS)"
ALLOWED=$(curl -s -m 60 -D - -o /dev/null -H "Origin: https://evil.example" "$API/health" | tr -d '\r' | grep -i '^access-control-allow-origin:')
check "A strange website is not allowed" "$(echo "$ALLOWED" | grep -qi 'evil.example' && echo no || echo yes)"

echo
echo "6. Cloud settings"
WILDCARDS=0
for ROLE in $(aws iam list-roles --query "Roles[?starts_with(RoleName, 'campus-')].RoleName" --output text); do
  for POLICY in $(aws iam list-role-policies --role-name "$ROLE" --query PolicyNames --output text); do
    if aws iam get-role-policy --role-name "$ROLE" --policy-name "$POLICY" --output json | grep -q '"Resource": "\*"'; then
      WILDCARDS=$((WILDCARDS + 1))
    fi
  done
done
check "No IAM role allows everything (Resource: *)" "$(same "$WILDCARDS" 0)"
SETTINGS=$(aws lambda get-function-configuration --function-name campus-events --query Environment.Variables --output json)
check "The database password is not in the Lambda settings" "$(echo "$SETTINGS" | grep -q 'postgresql://' && echo no || echo yes)"
check "The Gmail password is not in the Lambda settings" "$(echo "$SETTINGS" | grep -q 'EMAIL_APP_PASSWORD' && echo no || echo yes)"
AUTH_LOGS=$(MSYS_NO_PATHCONV=1 aws logs filter-log-events --log-group-name /aws/lambda/campus-auth --query 'events[].message' --output text 2>/dev/null)
check "Passwords and tokens never appear in the logs" "$(echo "$AUTH_LOGS" | grep -q -e "$PASSWORD" -e "$ORGANIZER_TOKEN" && echo no || echo yes)"

echo
echo "7. Too many requests"
LOGIN_CODES=""
for TRY in $(seq 1 12); do
  LOGIN_CODES="$LOGIN_CODES $(call POST /auth/login "" '{"email":"nobody@security.check","password":"wrongpassword"}')"
done
check "Guessing passwords is stopped after 10 tries (429)" "$(echo "$LOGIN_CODES" | grep -q 429 && echo yes || echo no)"
FLOOD_CODES=""
for TRY in $(seq 1 110); do
  FLOOD_CODES="$FLOOD_CODES $(call GET /events/mine "")"
done
check "110 requests in a minute are stopped (429)" "$(echo "$FLOOD_CODES" | grep -q 429 && echo yes || echo no)"
FAKE_IP=$(curl -s -m 60 -o /dev/null -w "%{http_code}" -H "X-Forwarded-For: 9.9.9.9" "$API/events/mine")
check "A fake X-Forwarded-For does not get around the limit" "$(same "$FAKE_IP" 429)"

rm -rf "$WORK_FOLDER"
echo
echo "Result: $PASSED passed, $FAILED failed"
echo "Your address is rate limited for one minute now."
