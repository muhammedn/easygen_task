import type { PublicUser } from '../../users/types/public-user.js';

export type AuthResponse = {
  accessToken: string;
  user: PublicUser;
};

export type JwtPayload = {
  sub: string;
  email: string;
  tv: number;
};
