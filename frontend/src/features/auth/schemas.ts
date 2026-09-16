import { z } from 'zod';

// Keep in sync with backend/src/common/constants/validation.ts
export const NAME_MIN_LENGTH = 3;
export const NAME_MAX_LENGTH = 100;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;
export const PASSWORD_REGEX =
  /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;
export const PASSWORD_REQUIREMENTS_MESSAGE =
  'Password must be at least 8 characters and include at least one letter, one number, and one special character';

export const signUpSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  name: z
    .string()
    .trim()
    .min(NAME_MIN_LENGTH, `Name must be at least ${NAME_MIN_LENGTH} characters`)
    .max(NAME_MAX_LENGTH, `Name must be at most ${NAME_MAX_LENGTH} characters`),
  password: z
    .string()
    .min(
      PASSWORD_MIN_LENGTH,
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    )
    .max(
      PASSWORD_MAX_LENGTH,
      `Password must be at most ${PASSWORD_MAX_LENGTH} characters`,
    )
    .regex(PASSWORD_REGEX, PASSWORD_REQUIREMENTS_MESSAGE),
});

export const signInSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .max(
      PASSWORD_MAX_LENGTH,
      `Password must be at most ${PASSWORD_MAX_LENGTH} characters`,
    ),
});

export type SignUpValues = z.infer<typeof signUpSchema>;
export type SignInValues = z.infer<typeof signInSchema>;
