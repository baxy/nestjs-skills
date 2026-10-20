const REQUIRED = [
  'DB_HOST',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_NAME',
  'REDIS_HOST',
  'AUTH_JWT_SECRET',
  'AUTH_JWT_ISSUER',
  'AUTH_JWT_AUDIENCE',
] as const;

export function validateEnv(env: Record<string, unknown>): Record<string, unknown> {
  const missing = REQUIRED.filter((name) => !String(env[name] ?? '').trim());
  if (missing.length > 0) {
    throw new Error(`Refusing to start: ${missing.join(', ')} must be set`);
  }
  return env;
}
