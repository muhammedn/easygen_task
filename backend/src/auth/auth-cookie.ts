import type { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import ms, { type StringValue } from 'ms';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';
export const REFRESH_TOKEN_COOKIE_PATH = '/auth/refresh';

export function buildAccessCookieOptions(
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

export function buildRefreshCookieOptions(
  configService: ConfigService,
): CookieOptions {
  const refreshExpiresIn = configService.getOrThrow<string>(
    'refreshTokenExpiresIn',
  );
  const maxAge = ms(refreshExpiresIn as StringValue);

  if (typeof maxAge !== 'number') {
    throw new Error(
      `Invalid REFRESH_TOKEN_EXPIRES_IN value: ${refreshExpiresIn}`,
    );
  }

  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: configService.getOrThrow<boolean>('cookieSecure'),
    path: REFRESH_TOKEN_COOKIE_PATH,
    maxAge,
  };
}

function clearCookieAttrs(options: CookieOptions): CookieOptions {
  return {
    httpOnly: options.httpOnly,
    sameSite: options.sameSite,
    secure: options.secure,
    path: options.path,
  };
}

export function applySessionCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
  accessOptions: CookieOptions,
  refreshOptions: CookieOptions,
): void {
  res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, accessOptions);
  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, refreshOptions);
}

export function clearSessionCookies(
  res: Response,
  accessOptions: CookieOptions,
  refreshOptions: CookieOptions,
): void {
  res.clearCookie(ACCESS_TOKEN_COOKIE, clearCookieAttrs(accessOptions));
  res.clearCookie(REFRESH_TOKEN_COOKIE, clearCookieAttrs(refreshOptions));
}
