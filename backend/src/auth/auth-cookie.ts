import type { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import ms, { type StringValue } from 'ms';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';
export const REFRESH_TOKEN_COOKIE_PATH = '/auth/refresh';

function cookieBaseOptions(configService: ConfigService): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: configService.getOrThrow<boolean>('cookieSecure'),
  };
}

export function buildCookieOptions(
  configService: ConfigService,
): CookieOptions {
  const jwtExpiresIn = configService.getOrThrow<string>('jwtExpiresIn');
  const maxAge = ms(jwtExpiresIn as StringValue);

  if (typeof maxAge !== 'number') {
    throw new Error(`Invalid JWT_EXPIRES_IN value: ${jwtExpiresIn}`);
  }

  return {
    ...cookieBaseOptions(configService),
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
    ...cookieBaseOptions(configService),
    path: REFRESH_TOKEN_COOKIE_PATH,
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

export function setRefreshCookie(
  res: Response,
  token: string,
  configService: ConfigService,
): void {
  res.cookie(
    REFRESH_TOKEN_COOKIE,
    token,
    buildRefreshCookieOptions(configService),
  );
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

export function clearRefreshCookie(
  res: Response,
  configService: ConfigService,
): void {
  const options = buildRefreshCookieOptions(configService);
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: options.httpOnly,
    sameSite: options.sameSite,
    secure: options.secure,
    path: options.path,
  });
}

export function clearAuthCookies(
  res: Response,
  configService: ConfigService,
): void {
  clearAuthCookie(res, configService);
  clearRefreshCookie(res, configService);
}
