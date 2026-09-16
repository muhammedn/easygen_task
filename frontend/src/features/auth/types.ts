export type PublicUser = {
  id: string;
  email: string;
  name: string;
};

export type AuthResponse = {
  user: PublicUser;
};

export type MeResponse = {
  user: PublicUser;
};
