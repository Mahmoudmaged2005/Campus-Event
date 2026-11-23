function readCorsOrigins() {
  const corsOriginsText = process.env.CORS_ORIGINS || '*';
  if (corsOriginsText === '*') {
    return '*';
  }
  const origins = [];
  const parts = corsOriginsText.split(',');
  for (const part of parts) {
    origins.push(part.trim());
  }
  return origins;
}

function readS3PublicUrl(endpoint, bucket, region) {
  if (process.env.S3_PUBLIC_URL) {
    return process.env.S3_PUBLIC_URL;
  }
  if (endpoint) {
    return endpoint + '/' + bucket;
  }
  return 'https://' + bucket + '.s3.' + region + '.amazonaws.com';
}

const awsRegion = process.env.AWS_REGION || 'eu-central-1';
const s3Endpoint = process.env.S3_ENDPOINT || '';
const s3Bucket = process.env.S3_BUCKET || 'campus-events-images';

export const config = {
  port: Number(process.env.PORT) || 3000,
  corsOrigins: readCorsOrigins(),
  awsRegion: awsRegion,
  s3Endpoint: s3Endpoint,
  s3Bucket: s3Bucket,
  s3PublicUrl: readS3PublicUrl(s3Endpoint, s3Bucket, awsRegion),
};
