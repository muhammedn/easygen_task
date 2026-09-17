import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import {
  applySessionCookies,
  buildAccessCookieOptions,
  buildRefreshCookieOptions,
  clearSessionCookies,
} from './auth-cookie.js';

@Injectable()
export class AuthCookieService {
  private readonly accessOptions: CookieOptions;
  private readonly refreshOptions: CookieOptions;

  constructor(configService: ConfigService) {
    this.accessOptions = buildAccessCookieOptions(configService);
    this.refreshOptions = buildRefreshCookieOptions(configService);
  }

  setSession(
    res: Response,
    tokens: { accessToken: string; refreshToken: string },
  ): void {
    applySessionCookies(res, tokens, this.accessOptions, this.refreshOptions);
  }

  clearSession(res: Response): void {
    clearSessionCookies(res, this.accessOptions, this.refreshOptions);
  }
}
