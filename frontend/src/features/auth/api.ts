import api from '@/lib/api';
import type { AuthResponse, MeResponse } from '@/features/auth/types';
import type { SignInValues, SignUpValues } from '@/features/auth/schemas';

export async function signup(values: SignUpValues): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/signup', values);
  return data;
}

export async function signin(values: SignInValues): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/signin', values);
  return data;
}

export async function me(): Promise<MeResponse> {
  const { data } = await api.get<MeResponse>('/auth/me');
  return data;
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}
