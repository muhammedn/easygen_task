export type AppConfig = {
  nodeEnv: string;
  port: number;
  mongodbUri: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTokenExpiresIn: string;
  corsOrigin: string[];
  cookieSecure: boolean;
  trustProxy: boolean;
};

function parseOptionalBoolean(
  value: string | undefined,
  fallback: boolean,
): boolean {
  if (value === undefined) {
    return fallback;
  }
  return value === 'true' || value === '1';
}

/**
 * Reads process.env after Joi validation. Joi defaults are not written back
 * to process.env, so mirror the same defaults here for optional keys.
 */
export default (): AppConfig => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';

  return {
    nodeEnv,
    port: Number(process.env.PORT ?? 3000),
    mongodbUri: process.env.MONGODB_URI as string,
    jwtSecret: process.env.JWT_SECRET as string,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN ?? '7d',
    corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    cookieSecure: parseOptionalBoolean(
      process.env.COOKIE_SECURE,
      nodeEnv === 'production',
    ),
    trustProxy: parseOptionalBoolean(process.env.TRUST_PROXY, false),
  };
};
