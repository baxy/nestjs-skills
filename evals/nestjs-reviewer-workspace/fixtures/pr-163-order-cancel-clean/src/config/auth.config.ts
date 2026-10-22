import { registerAs } from '@nestjs/config';

export const authConfig = registerAs('auth', () => ({
  jwt: {
    secret: process.env.AUTH_JWT_SECRET || '',
    issuer: process.env.AUTH_JWT_ISSUER || '',
    audience: process.env.AUTH_JWT_AUDIENCE || '',
    accessTokenTtl: process.env.AUTH_JWT_ACCESS_TOKEN_TTL || '15m',
  },
}));
