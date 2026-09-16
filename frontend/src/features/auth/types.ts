export type PublicUser = {
  id: string;
  email: string;
  name: string;
};

export type AuthResponse = {
  accessToken: string;
  user: PublicUser;
};

export type MeResponse = {
  user: PublicUser;
};
