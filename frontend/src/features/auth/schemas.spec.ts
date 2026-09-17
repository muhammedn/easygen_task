import { describe, expect, it } from 'vitest';
import {
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  signInSchema,
  signUpSchema,
} from './schemas';

describe('signUpSchema', () => {
  const valid = {
    email: 'jane@example.com',
    name: 'Jane Doe',
    password: 'Secret1!',
  };

  it('accepts a valid payload', () => {
    expect(signUpSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const result = signUpSchema.safeParse({ ...valid, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects a short name', () => {
    const result = signUpSchema.safeParse({ ...valid, name: 'Jo' });
    expect(result.success).toBe(false);
  });

  it('rejects an overlong name', () => {
    const result = signUpSchema.safeParse({
      ...valid,
      name: 'a'.repeat(NAME_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });

  it('rejects a weak password', () => {
    const result = signUpSchema.safeParse({ ...valid, password: 'password' });
    expect(result.success).toBe(false);
  });

  it('rejects an overlong password', () => {
    const result = signUpSchema.safeParse({
      ...valid,
      password: `${'a'.repeat(PASSWORD_MAX_LENGTH)}1!`,
    });
    expect(result.success).toBe(false);
  });
});

describe('signInSchema', () => {
  it('accepts a valid payload', () => {
    expect(
      signInSchema.safeParse({
        email: 'jane@example.com',
        password: 'anything',
      }).success,
    ).toBe(true);
  });

  it('rejects an empty password', () => {
    const result = signInSchema.safeParse({
      email: 'jane@example.com',
      password: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid email', () => {
    const result = signInSchema.safeParse({
      email: 'bad',
      password: 'Secret1!',
    });
    expect(result.success).toBe(false);
  });
});
