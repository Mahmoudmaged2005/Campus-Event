import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

function secretsClient() {
  const options = { region: process.env.AWS_REGION || 'eu-central-1' };
  if (process.env.SECRETS_ENDPOINT) {
    options.endpoint = process.env.SECRETS_ENDPOINT;
  }
  return new SecretsManagerClient(options);
}

async function loadSecretInto(settingName, secretNameSetting) {
  if (process.env[settingName]) {
    return;
  }
  const secretName = process.env[secretNameSetting];
  if (!secretName) {
    return;
  }
  const result = await secretsClient().send(new GetSecretValueCommand({ SecretId: secretName }));
  process.env[settingName] = result.SecretString;
}

await loadSecretInto('DATABASE_URL', 'DATABASE_SECRET_NAME');
await loadSecretInto('MAILJET_API_KEY', 'MAILJET_API_KEY_SECRET_NAME');
await loadSecretInto('MAILJET_SECRET_KEY', 'MAILJET_SECRET_KEY_SECRET_NAME');
