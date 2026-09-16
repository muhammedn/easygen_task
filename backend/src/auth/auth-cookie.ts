import type { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import ms, { type StringValue } from 'ms';

export const ACCESS_TOKEN_COOKIE = 'access_token';

export function buildCookieOptions(
  configService: ConfigService,
): CookieOptions {
  const jwtExpiresIn = configService.getOrThrow<string>('jwtExpiresIn');
  const maxAge = ms(jwtExpiresIn as StringValue);

  if (typeof maxAge !== 'number') {
    throw new Error(`Invalid JWT_EXPIRES_IN value: ${jwtExpiresIn}`);
  }

  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: configService.getOrThrow<boolean>('cookieSecure'),
    path: '/',
    maxAge,
  };
}

export function setAuthCookie(
  res: Response,
  token: string,
  configService: ConfigService,
): void {
  res.cookie(ACCESS_TOKEN_COOKIE, token, buildCookieOptions(configService));
}

export function clearAuthCookie(
  res: Response,
  configService: ConfigService,
): void {
  const options = buildCookieOptions(configService);
  res.clearCookie(ACCESS_TOKEN_COOKIE, {
    httpOnly: options.httpOnly,
    sameSite: options.sameSite,
    secure: options.secure,
    path: options.path,
  });
}
