import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
  Body,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { PublicUser } from '../users/types/public-user.js';
import {
  clearAuthCookies,
  REFRESH_TOKEN_COOKIE,
  setAuthCookie,
  setRefreshCookie,
} from './auth-cookie.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { AuthResponseDto } from './dto/auth-response.dto.js';
import { SignInDto } from './dto/signin.dto.js';
import { SignUpDto } from './dto/signup.dto.js';
import { UserResponseDto } from './dto/user-response.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('signup')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register a new user' })
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiConflictResponse({ description: 'Email already in use' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  async signup(
    @Body() dto: SignUpDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.signup(dto);
    setAuthCookie(res, result.accessToken, this.configService);
    setRefreshCookie(res, result.refreshToken, this.configService);
    return { user: result.user };
  }

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  async signin(
    @Body() dto: SignInDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.signin(dto);
    setAuthCookie(res, result.accessToken, this.configService);
    setRefreshCookie(res, result.refreshToken, this.configService);
    return { user: result.user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiCookieAuth('refresh_token')
  @ApiOperation({
    summary: 'Rotate the refresh token and issue a new access token',
  })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid refresh token' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const cookies = req.cookies as Record<string, string> | undefined;
    const rawToken = cookies?.[REFRESH_TOKEN_COOKIE];

    try {
      const result = await this.authService.refresh(rawToken);
      setAuthCookie(res, result.accessToken, this.configService);
      setRefreshCookie(res, result.refreshToken, this.configService);
      return { user: result.user };
    } catch (error) {
      clearAuthCookies(res, this.configService);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Revoke the session and clear auth cookies' })
  @ApiNoContentResponse({ description: 'Cookies cleared and tokens revoked' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
  async logout(
    @CurrentUser() user: PublicUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logout(user.id);
    clearAuthCookies(res, this.configService);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get the current authenticated user' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        user: { $ref: '#/components/schemas/UserResponseDto' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
  me(@CurrentUser() user: PublicUser): { user: UserResponseDto } {
    return { user };
  }
}
