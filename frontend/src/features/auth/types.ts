export type PublicUser = {
  id: string;
  email: string;
  name: string;
};

export type UserEnvelope = {
  user: PublicUser;
};
