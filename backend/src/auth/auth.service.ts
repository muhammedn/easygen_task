import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service.js';
import type { UserDocument } from '../users/schemas/user.schema.js';
import type { SignInDto } from './dto/signin.dto.js';
import type { SignUpDto } from './dto/signup.dto.js';
import { RefreshTokenService } from './refresh-token.service.js';
import type { AuthResponse, JwtPayload } from './types/auth-response.js';

const BCRYPT_COST = 12;
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly dummyPasswordHash: string;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {
    this.dummyPasswordHash = bcrypt.hashSync(
      'dummy-password-for-timing',
      BCRYPT_COST,
    );
  }

  async signup(dto: SignUpDto): Promise<AuthResponse> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);

    try {
      const user = await this.usersService.create({
        email: dto.email,
        name: dto.name,
        passwordHash,
      });
      return this.issueSession(user);
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException('Email already in use');
      }
      throw error;
    }
  }

  async signin(dto: SignInDto): Promise<AuthResponse> {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    if (!user) {
      await bcrypt.compare(dto.password, this.dummyPasswordHash);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
      throw new HttpException(
        'Too many failed attempts, try again later',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      await this.usersService.recordFailedLogin(
        user.id as string,
        MAX_FAILED_LOGIN_ATTEMPTS,
        LOCKOUT_DURATION_MS,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.failedLoginAttempts > 0 || user.lockUntil) {
      await this.usersService.resetLoginFailures(user.id as string);
    }

    return this.issueSession(user);
  }

  async refresh(rawToken: string | undefined): Promise<AuthResponse> {
    if (!rawToken) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const session = await this.refreshTokenService.findByToken(rawToken);
    if (!session) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (session.revokedAt) {
      await this.refreshTokenService.revokeFamily(session.familyId);
      await this.usersService.bumpTokenVersion(session.userId.toString());
      throw new UnauthorizedException('Invalid credentials');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = await this.usersService.findById(session.userId.toString());
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const rotated = await this.refreshTokenService.rotate(session);
    const accessToken = await this.signToken(user);
    return {
      accessToken,
      refreshToken: rotated.token,
      user: this.usersService.toPublicUser(user),
    };
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.bumpTokenVersion(userId);
    await this.refreshTokenService.revokeAllForUser(userId);
  }

  private async issueSession(user: UserDocument): Promise<AuthResponse> {
    const publicUser = this.usersService.toPublicUser(user);
    const accessToken = await this.signToken(user);
    const refresh = await this.refreshTokenService.issue(user.id as string);
    return {
      accessToken,
      refreshToken: refresh.token,
      user: publicUser,
    };
  }

  private async signToken(user: UserDocument): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id as string,
      email: user.email,
      tv: user.tokenVersion ?? 0,
    };
    return this.jwtService.signAsync(payload);
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: number }).code === 11000
    );
  }
}
