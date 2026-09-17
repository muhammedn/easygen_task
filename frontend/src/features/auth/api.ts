import api from '@/lib/api';
import type { UserEnvelope } from '@/features/auth/types';
import type { SignInValues, SignUpValues } from '@/features/auth/schemas';

export async function signup(values: SignUpValues): Promise<UserEnvelope> {
  const { data } = await api.post<UserEnvelope>('/auth/signup', values);
  return data;
}

export async function signin(values: SignInValues): Promise<UserEnvelope> {
  const { data } = await api.post<UserEnvelope>('/auth/signin', values);
  return data;
}

export async function me(): Promise<UserEnvelope> {
  const { data } = await api.get<UserEnvelope>('/auth/me');
  return data;
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}

export async function refresh(): Promise<UserEnvelope> {
  const { data } = await api.post<UserEnvelope>('/auth/refresh');
  return data;
}
