import type { PublicUser } from '../../users/types/public-user.js';

export type IssuedSession = {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
};

export type JwtPayload = {
  sub: string;
  email: string;
  tv: number;
};
