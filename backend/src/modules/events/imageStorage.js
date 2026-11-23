import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../../shared/config.js';

let s3Client = null;

function s3() {
  if (s3Client === null) {
    const options = { region: config.awsRegion, forcePathStyle: true };
    if (config.s3Endpoint) {
      options.endpoint = config.s3Endpoint;
    }
    s3Client = new S3Client(options);
  }
  return s3Client;
}

export async function saveImage(key, bytes, contentType) {
  await s3().send(
    new PutObjectCommand({
      Bucket: config.s3Bucket,
      Key: key,
      Body: bytes,
      ContentType: contentType,
    }),
  );
  return config.s3PublicUrl + '/' + key;
}

function keyFromUrl(imageUrl) {
  const start = config.s3PublicUrl + '/';
  if (!imageUrl.startsWith(start)) {
    return null;
  }
  return imageUrl.slice(start.length);
}

export async function deleteImageByUrl(imageUrl) {
  const key = keyFromUrl(imageUrl);
  if (key === null) {
    return;
  }
  try {
    await s3().send(new DeleteObjectCommand({ Bucket: config.s3Bucket, Key: key }));
  } catch (error) {
    console.error('Could not delete image ' + key + ': ' + error.message);
  }
}
