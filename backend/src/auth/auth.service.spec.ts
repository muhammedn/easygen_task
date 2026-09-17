import {
  ConflictException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { Types } from 'mongoose';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserDocument } from '../users/schemas/user.schema.js';
import { UsersService } from '../users/users.service.js';
import {
  LOCKOUT_DURATION_MS,
  MAX_FAILED_LOGIN_ATTEMPTS,
} from './auth.constants.js';
import { AuthService } from './auth.service.js';
import { RefreshTokenService } from './refresh-token.service.js';
import type { RefreshSessionDocument } from './schemas/refresh-session.schema.js';

describe('AuthService', () => {
  const email = 'jane@example.com';
  const name = 'Jane Doe';
  const password = 'Secret1!';
  const userId = '507f1f77bcf86cd799439011';
  const familyId = 'family-1';
  const refreshToken = 'opaque-refresh-token';

  let passwordHash: string;
  let usersService: {
    findByEmail: ReturnType<typeof vi.fn>;
    findByEmailWithPassword: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    recordFailedLogin: ReturnType<typeof vi.fn>;
    resetLoginFailures: ReturnType<typeof vi.fn>;
    bumpTokenVersion: ReturnType<typeof vi.fn>;
  };
  let jwtService: {
    signAsync: ReturnType<typeof vi.fn>;
  };
  let refreshTokenService: {
    issue: ReturnType<typeof vi.fn>;
    findByToken: ReturnType<typeof vi.fn>;
    rotate: ReturnType<typeof vi.fn>;
    revokeFamily: ReturnType<typeof vi.fn>;
    revokeAllForUser: ReturnType<typeof vi.fn>;
  };
  let authService: AuthService;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(password, 12);
  });

  beforeEach(() => {
    usersService = {
      findByEmail: vi.fn(),
      findByEmailWithPassword: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      recordFailedLogin: vi.fn().mockResolvedValue(undefined),
      resetLoginFailures: vi.fn().mockResolvedValue(undefined),
      bumpTokenVersion: vi.fn().mockResolvedValue(undefined),
    };
    jwtService = {
      signAsync: vi.fn().mockResolvedValue('signed-token'),
    };
    refreshTokenService = {
      issue: vi.fn().mockResolvedValue({
        token: refreshToken,
        session: { familyId },
      }),
      findByToken: vi.fn(),
      rotate: vi.fn().mockResolvedValue({
        token: 'rotated-refresh-token',
        session: { familyId },
      }),
      revokeFamily: vi.fn().mockResolvedValue(undefined),
      revokeAllForUser: vi.fn().mockResolvedValue(undefined),
    };
    authService = new AuthService(
      usersService as unknown as UsersService,
      jwtService as unknown as JwtService,
      refreshTokenService as unknown as RefreshTokenService,
    );
  });

  describe('signup', () => {
    it('creates a user and returns accessToken with public user', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      const created = {
        id: userId,
        email,
        name,
        passwordHash,
        tokenVersion: 0,
        failedLoginAttempts: 0,
        lockUntil: null,
      } as UserDocument;
      usersService.create.mockResolvedValue(created);

      const result = await authService.signup({ email, name, password });

      expect(result).toEqual({
        accessToken: 'signed-token',
        refreshToken,
        user: { id: userId, email, name },
      });
      expect(refreshTokenService.issue).toHaveBeenCalledWith(userId);
      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email,
          name,
          passwordHash: expect.any(String),
        }),
      );
      const createArg = usersService.create.mock.calls[0][0] as {
        passwordHash: string;
      };
      expect(createArg.passwordHash).not.toBe(password);
      expect(await bcrypt.compare(password, createArg.passwordHash)).toBe(true);
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: userId,
        email,
        tv: 0,
      });
    });

    it('throws ConflictException when email already exists', async () => {
      usersService.findByEmail.mockResolvedValue({
        id: userId,
        email,
        name,
      } as UserDocument);

      await expect(
        authService.signup({ email, name, password }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException on duplicate key race', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockRejectedValue({ code: 11000 });

      await expect(
        authService.signup({ email, name, password }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('signin', () => {
    it('returns accessToken and public user on valid credentials', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue({
        id: userId,
        email,
        name,
        passwordHash,
        tokenVersion: 2,
        failedLoginAttempts: 0,
        lockUntil: null,
      } as UserDocument);

      const result = await authService.signin({ email, password });

      expect(result).toEqual({
        accessToken: 'signed-token',
        refreshToken,
        user: { id: userId, email, name },
      });
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: userId,
        email,
        tv: 2,
      });
      expect(usersService.resetLoginFailures).not.toHaveBeenCalled();
    });

    it('resets login failures after a successful signin', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue({
        id: userId,
        email,
        name,
        passwordHash,
        tokenVersion: 0,
        failedLoginAttempts: 2,
        lockUntil: null,
      } as UserDocument);

      await authService.signin({ email, password });

      expect(usersService.resetLoginFailures).toHaveBeenCalledWith(userId);
    });

    it('throws UnauthorizedException for wrong password and records failure', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue({
        id: userId,
        email,
        name,
        passwordHash,
        tokenVersion: 0,
        failedLoginAttempts: 1,
        lockUntil: null,
      } as UserDocument);

      await expect(
        authService.signin({ email, password: 'Wrong1!' }),
      ).rejects.toSatisfy((error: unknown) => {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect((error as UnauthorizedException).message).toBe(
          'Invalid credentials',
        );
        return true;
      });
      expect(usersService.recordFailedLogin).toHaveBeenCalledWith(
        userId,
        MAX_FAILED_LOGIN_ATTEMPTS,
        LOCKOUT_DURATION_MS,
      );
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException for unknown email', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(null);

      await expect(authService.signin({ email, password })).rejects.toSatisfy(
        (error: unknown) => {
          expect(error).toBeInstanceOf(UnauthorizedException);
          expect((error as UnauthorizedException).message).toBe(
            'Invalid credentials',
          );
          return true;
        },
      );
      expect(jwtService.signAsync).not.toHaveBeenCalled();
      expect(usersService.recordFailedLogin).not.toHaveBeenCalled();
    });

    it('throws 429 when the account is locked', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue({
        id: userId,
        email,
        name,
        passwordHash,
        tokenVersion: 0,
        failedLoginAttempts: 0,
        lockUntil: new Date(Date.now() + 60_000),
      } as UserDocument);

      await expect(authService.signin({ email, password })).rejects.toSatisfy(
        (error: unknown) => {
          expect(error).toBeInstanceOf(HttpException);
          expect((error as HttpException).getStatus()).toBe(
            HttpStatus.TOO_MANY_REQUESTS,
          );
          return true;
        },
      );
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('allows signin when lockUntil is in the past', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue({
        id: userId,
        email,
        name,
        passwordHash,
        tokenVersion: 0,
        failedLoginAttempts: 0,
        lockUntil: new Date(Date.now() - 60_000),
      } as UserDocument);

      const result = await authService.signin({ email, password });

      expect(result.accessToken).toBe('signed-token');
      expect(usersService.resetLoginFailures).toHaveBeenCalledWith(userId);
      expect(jwtService.signAsync).toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    const activeSession = {
      userId: new Types.ObjectId(userId),
      familyId,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    } as RefreshSessionDocument;

    it('rotates the refresh token and returns a new access token', async () => {
      refreshTokenService.findByToken.mockResolvedValue(activeSession);
      usersService.findById.mockResolvedValue({
        id: userId,
        email,
        name,
        tokenVersion: 1,
      } as UserDocument);

      const result = await authService.refresh(refreshToken);

      expect(refreshTokenService.rotate).toHaveBeenCalledWith(activeSession);
      expect(result).toEqual({
        accessToken: 'signed-token',
        refreshToken: 'rotated-refresh-token',
        user: { id: userId, email, name },
      });
    });

    it('rejects a missing token', async () => {
      await expect(authService.refresh(undefined)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects an unknown token', async () => {
      refreshTokenService.findByToken.mockResolvedValue(null);

      await expect(authService.refresh(refreshToken)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('treats recent reuse as a benign race without burning the family', async () => {
      refreshTokenService.findByToken.mockResolvedValue({
        ...activeSession,
        revokedAt: new Date(),
      } as RefreshSessionDocument);

      await expect(authService.refresh(refreshToken)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(refreshTokenService.revokeFamily).not.toHaveBeenCalled();
      expect(usersService.bumpTokenVersion).not.toHaveBeenCalled();
      expect(refreshTokenService.rotate).not.toHaveBeenCalled();
    });

    it('detects reuse outside the grace window and burns the family', async () => {
      refreshTokenService.findByToken.mockResolvedValue({
        ...activeSession,
        revokedAt: new Date(Date.now() - 60_000),
      } as RefreshSessionDocument);

      await expect(authService.refresh(refreshToken)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(refreshTokenService.revokeFamily).toHaveBeenCalledWith(familyId);
      expect(usersService.bumpTokenVersion).toHaveBeenCalledWith(userId);
      expect(refreshTokenService.rotate).not.toHaveBeenCalled();
    });

    it('rejects when rotate loses the atomic claim', async () => {
      refreshTokenService.findByToken.mockResolvedValue(activeSession);
      usersService.findById.mockResolvedValue({
        id: userId,
        email,
        name,
        tokenVersion: 1,
      } as UserDocument);
      refreshTokenService.rotate.mockResolvedValue(null);

      await expect(authService.refresh(refreshToken)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(refreshTokenService.revokeFamily).not.toHaveBeenCalled();
    });

    it('rejects an expired session', async () => {
      refreshTokenService.findByToken.mockResolvedValue({
        ...activeSession,
        expiresAt: new Date(Date.now() - 1_000),
      } as RefreshSessionDocument);

      await expect(authService.refresh(refreshToken)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(refreshTokenService.rotate).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('bumps the token version and revokes refresh sessions', async () => {
      await authService.logout(userId);
      expect(usersService.bumpTokenVersion).toHaveBeenCalledWith(userId);
      expect(refreshTokenService.revokeAllForUser).toHaveBeenCalledWith(userId);
    });
  });
});
