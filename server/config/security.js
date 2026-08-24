const developmentSecret = 'development-secret-change-me';

export const jwtSecret = process.env.JWT_SECRET ||
  (process.env.NODE_ENV === 'production' ? null : developmentSecret);

if (!jwtSecret) {
  throw new Error('JWT_SECRET must be configured before TRACKER can run in production.');
}
