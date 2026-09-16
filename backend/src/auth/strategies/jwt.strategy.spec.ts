import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserDocument } from '../../users/schemas/user.schema.js';
import { UsersService } from '../../users/users.service.js';
import { JwtStrategy } from './jwt.strategy.js';

describe('JwtStrategy', () => {
  const userId = '507f1f77bcf86cd799439011';
  const email = 'jane@example.com';
  const name = 'Jane Doe';

  let usersService: {
    findById: ReturnType<typeof vi.fn>;
    toPublicUser: ReturnType<typeof vi.fn>;
  };
  let strategy: JwtStrategy;

  beforeEach(() => {
    usersService = {
      findById: vi.fn(),
      toPublicUser: vi.fn((user: { id: string; email: string; name: string }) => ({
        id: user.id,
        email: user.email,
        name: user.name,
      })),
    };

    const configService = {
      getOrThrow: vi.fn((key: string) => {
        if (key === 'jwtSecret') {
          return 'test-jwt-secret-at-least-32-chars!!';
        }
        throw new Error(`Unexpected config key: ${key}`);
      }),
    };

    strategy = new JwtStrategy(
      configService as unknown as ConfigService,
      usersService as unknown as UsersService,
    );
  });

  it('returns the public user when tokenVersion matches', async () => {
    usersService.findById.mockResolvedValue({
      id: userId,
      email,
      name,
      tokenVersion: 3,
    } as UserDocument);

    const result = await strategy.validate({
      sub: userId,
      email,
      tv: 3,
    });

    expect(result).toEqual({ id: userId, email, name });
    expect(usersService.findById).toHaveBeenCalledWith(userId);
  });

  it('rejects when the user no longer exists', async () => {
    usersService.findById.mockResolvedValue(null);

    await expect(
      strategy.validate({ sub: userId, email, tv: 0 }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(usersService.toPublicUser).not.toHaveBeenCalled();
  });

  it('rejects when tokenVersion does not match (revoked session)', async () => {
    usersService.findById.mockResolvedValue({
      id: userId,
      email,
      name,
      tokenVersion: 2,
    } as UserDocument);

    await expect(
      strategy.validate({ sub: userId, email, tv: 1 }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).message).toBe(
        'Invalid credentials',
      );
      return true;
    });
    expect(usersService.toPublicUser).not.toHaveBeenCalled();
  });
});
