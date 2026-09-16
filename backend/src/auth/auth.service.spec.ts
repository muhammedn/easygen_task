import {
  ConflictException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserDocument } from '../users/schemas/user.schema.js';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  const email = 'jane@example.com';
  const name = 'Jane Doe';
  const password = 'Secret1!';
  const userId = '507f1f77bcf86cd799439011';

  let passwordHash: string;
  let usersService: {
    findByEmail: ReturnType<typeof vi.fn>;
    findByEmailWithPassword: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    toPublicUser: ReturnType<typeof vi.fn>;
    recordFailedLogin: ReturnType<typeof vi.fn>;
    resetLoginFailures: ReturnType<typeof vi.fn>;
    bumpTokenVersion: ReturnType<typeof vi.fn>;
  };
  let jwtService: {
    signAsync: ReturnType<typeof vi.fn>;
  };
  let authService: AuthService;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(password, 12);
  });

  beforeEach(() => {
    usersService = {
      findByEmail: vi.fn(),
      findByEmailWithPassword: vi.fn(),
      create: vi.fn(),
      toPublicUser: vi.fn(
        (user: { id: string; email: string; name: string }) => ({
          id: user.id,
          email: user.email,
          name: user.name,
        }),
      ),
      recordFailedLogin: vi.fn().mockResolvedValue(undefined),
      resetLoginFailures: vi.fn().mockResolvedValue(undefined),
      bumpTokenVersion: vi.fn().mockResolvedValue(undefined),
    };
    jwtService = {
      signAsync: vi.fn().mockResolvedValue('signed-token'),
    };
    authService = new AuthService(
      usersService as unknown as UsersService,
      jwtService as unknown as JwtService,
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
        user: { id: userId, email, name },
      });
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
      expect(
        await bcrypt.compare(password, createArg.passwordHash),
      ).toBe(true);
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
        5,
        15 * 60 * 1000,
      );
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException for unknown email', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(null);

      await expect(
        authService.signin({ email, password }),
      ).rejects.toSatisfy((error: unknown) => {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect((error as UnauthorizedException).message).toBe(
          'Invalid credentials',
        );
        return true;
      });
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

      await expect(
        authService.signin({ email, password }),
      ).rejects.toSatisfy((error: unknown) => {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(
          HttpStatus.TOO_MANY_REQUESTS,
        );
        return true;
      });
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

  describe('logout', () => {
    it('bumps the token version', async () => {
      await authService.logout(userId);
      expect(usersService.bumpTokenVersion).toHaveBeenCalledWith(userId);
    });
  });
});
