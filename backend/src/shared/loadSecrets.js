import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

async function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return;
  }
  const secretName = process.env.DATABASE_SECRET_NAME;
  if (!secretName) {
    throw new Error('Set DATABASE_URL or DATABASE_SECRET_NAME');
  }
  const options = { region: process.env.AWS_REGION || 'eu-central-1' };
  if (process.env.SECRETS_ENDPOINT) {
    options.endpoint = process.env.SECRETS_ENDPOINT;
  }
  const secrets = new SecretsManagerClient(options);
  const result = await secrets.send(new GetSecretValueCommand({ SecretId: secretName }));
  process.env.DATABASE_URL = result.SecretString;
}

await loadDatabaseUrl();
