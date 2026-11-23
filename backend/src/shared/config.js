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

export const config = {
  port: Number(process.env.PORT) || 3000,
  corsOrigins: readCorsOrigins(),
};
