export const NAME_MIN_LENGTH = 3;
export const PASSWORD_MIN_LENGTH = 8;

/** At least one letter, one number, and one special character. */
export const PASSWORD_REGEX =
  /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

export const PASSWORD_REQUIREMENTS_MESSAGE =
  'Password must be at least 8 characters and include at least one letter, one number, and one special character';
