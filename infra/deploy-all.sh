#!/usr/bin/env bash
set -e

INFRA_FOLDER="$(cd "$(dirname "$0")" && pwd)"
cd "$INFRA_FOLDER/.."
source infra/env.sh

echo "== Starting Floci"
docker compose -f infra/floci/docker-compose.yml up -d
for TRY in $(seq 1 30); do
  if curl -s -o /dev/null http://localhost:4566/; then
    break
  fi
  sleep 2
done

echo "== S3 bucket for posters"
bash infra/s3-setup.sh
echo "== SNS topic and SQS queues"
bash infra/messaging-setup.sh
echo "== IAM role for the Lambdas"
bash infra/iam-setup.sh
echo "== Building the Lambda zip files"
bash infra/build-lambdas.sh
echo "== Lambda functions"
bash infra/lambda-setup.sh
echo "== API Gateway"
bash infra/api-setup.sh
echo "== Queue triggers"
bash infra/triggers-setup.sh
echo "== Timed jobs"
bash infra/schedules-setup.sh
echo "== CloudWatch alarms"
bash infra/monitoring-setup.sh
echo "== Website address"
bash infra/frontend-setup.sh

echo "== Everything is deployed on Floci"
