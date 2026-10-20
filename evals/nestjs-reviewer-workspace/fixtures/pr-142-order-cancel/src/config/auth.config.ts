import { registerAs } from '@nestjs/config';

export const authConfig = registerAs('auth', () => ({
  jwt: {
    secret: process.env.AUTH0_CLIENT_SECRET || '',
    issuer: process.env.AUTH0_ISSUER || '',
    audience: process.env.AUTH0_AUDIENCE || '',
    accessTokenTtl: process.env.AUTH0_ACCESS_TOKEN_TTL || '15m',
  },
}));
