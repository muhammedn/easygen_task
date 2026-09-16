import {
  ConflictException,
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
      } as UserDocument);

      const result = await authService.signin({ email, password });

      expect(result).toEqual({
        accessToken: 'signed-token',
        user: { id: userId, email, name },
      });
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: userId,
        email,
      });
    });

    it('throws UnauthorizedException for wrong password', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue({
        id: userId,
        email,
        name,
        passwordHash,
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
    });
  });
});
