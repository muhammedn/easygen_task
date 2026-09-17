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
import { toPublicUser } from '../users/types/public-user.js';
import {
  BCRYPT_COST,
  DUMMY_PASSWORD_HASH,
  LOCKOUT_DURATION_MS,
  MAX_FAILED_LOGIN_ATTEMPTS,
  REFRESH_REUSE_GRACE_MS,
} from './auth.constants.js';
import type { SignInDto } from './dto/signin.dto.js';
import type { SignUpDto } from './dto/signup.dto.js';
import { RefreshTokenService } from './refresh-token.service.js';
import type { RefreshSessionDocument } from './schemas/refresh-session.schema.js';
import type { IssuedSession, JwtPayload } from './types/auth-response.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  async signup(dto: SignUpDto): Promise<IssuedSession> {
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

  async signin(dto: SignInDto): Promise<IssuedSession> {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    if (!user) {
      await bcrypt.compare(dto.password, DUMMY_PASSWORD_HASH);
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

  async refresh(rawToken: string | undefined): Promise<IssuedSession> {
    if (!rawToken) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const session = await this.refreshTokenService.findByToken(rawToken);
    if (!session) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (session.revokedAt) {
      await this.handleReuse(session);
    }

    const user = await this.usersService.findById(session.userId.toString());
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const rotated = await this.refreshTokenService.rotate(session);
    if (!rotated) {
      // Another tab claimed this token first — treat as a benign race.
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = await this.signToken(user);
    return {
      accessToken,
      refreshToken: rotated.token,
      user: toPublicUser(user),
    };
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.bumpTokenVersion(userId);
    await this.refreshTokenService.revokeAllForUser(userId);
  }

  /**
   * Reuse of a revoked refresh token: within the grace window this is likely
   * a concurrent-tab race (401, keep family). Outside the window treat as theft
   * and burn the whole family.
   */
  private async handleReuse(session: RefreshSessionDocument): Promise<never> {
    const revokedAtMs = session.revokedAt?.getTime() ?? 0;
    const ageMs = Date.now() - revokedAtMs;

    if (ageMs > REFRESH_REUSE_GRACE_MS) {
      await this.refreshTokenService.revokeFamily(session.familyId);
      await this.usersService.bumpTokenVersion(session.userId.toString());
    }

    throw new UnauthorizedException('Invalid credentials');
  }

  private async issueSession(user: UserDocument): Promise<IssuedSession> {
    const accessToken = await this.signToken(user);
    const refresh = await this.refreshTokenService.issue(user.id as string);
    return {
      accessToken,
      refreshToken: refresh.token,
      user: toPublicUser(user),
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
