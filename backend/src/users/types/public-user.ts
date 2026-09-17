import type { UserDocument } from '../schemas/user.schema.js';

export type PublicUser = {
  id: string;
  email: string;
  name: string;
};

export function toPublicUser(user: UserDocument): PublicUser {
  return {
    id: user.id as string,
    email: user.email,
    name: user.name,
  };
}
