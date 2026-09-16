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
      const publicUser = this.usersService.toPublicUser(user);
      const accessToken = await this.signToken(user);
      return { accessToken, user: publicUser };
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

    const publicUser = this.usersService.toPublicUser(user);
    const accessToken = await this.signToken(user);
    return { accessToken, user: publicUser };
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.bumpTokenVersion(userId);
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
