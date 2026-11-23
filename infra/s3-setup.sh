#!/usr/bin/env bash
set -e

BUCKET="${S3_BUCKET:-campus-events-images}"
REGION="${AWS_DEFAULT_REGION:-eu-central-1}"
CORS_ORIGIN="${CORS_ORIGIN:-*}"

echo "Creating bucket $BUCKET in $REGION"
if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "Bucket already exists"
else
  aws s3api create-bucket \
    --bucket "$BUCKET" \
    --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION"
fi

echo "Allowing a public read policy on this bucket"
aws s3api put-public-access-block \
  --bucket "$BUCKET" \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false

echo "Public read for events/*"
aws s3api put-bucket-policy --bucket "$BUCKET" --policy "{
  \"Version\": \"2012-10-17\",
  \"Statement\": [{
    \"Sid\": \"PublicReadEventImages\",
    \"Effect\": \"Allow\",
    \"Principal\": \"*\",
    \"Action\": \"s3:GetObject\",
    \"Resource\": \"arn:aws:s3:::$BUCKET/events/*\"
  }]
}"

echo "CORS for $CORS_ORIGIN"
aws s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration "{
  \"CORSRules\": [{
    \"AllowedOrigins\": [\"$CORS_ORIGIN\"],
    \"AllowedMethods\": [\"GET\", \"HEAD\"],
    \"AllowedHeaders\": [\"*\"],
    \"MaxAgeSeconds\": 3000
  }]
}"

echo "Done. Bucket $BUCKET is ready."
