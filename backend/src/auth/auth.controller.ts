import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
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
import type { Response } from 'express';
import type { PublicUser } from '../users/types/public-user.js';
import { clearAuthCookie, setAuthCookie } from './auth-cookie.js';
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
    return { user: result.user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Revoke the session and clear the auth cookie' })
  @ApiNoContentResponse({ description: 'Cookie cleared and token revoked' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
  async logout(
    @CurrentUser() user: PublicUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logout(user.id);
    clearAuthCookie(res, this.configService);
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
