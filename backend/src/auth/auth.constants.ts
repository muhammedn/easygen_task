export const BCRYPT_COST = 12;

/** Precomputed bcrypt(BCRYPT_COST) of "dummy-password-for-timing" for unknown-email timing equalization. */
export const DUMMY_PASSWORD_HASH =
  '$2b$12$Ti.IBpPeFscdWIXaFnqF..u4XOeDrR.vj52XQO.MTV2NIevjofIFW';

export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

/** Benign concurrent-tab refresh races within this window do not burn the session family. */
export const REFRESH_REUSE_GRACE_MS = 15_000;

export const AUTH_THROTTLE = {
  signupSignin: { limit: 10, ttl: 60_000 },
  refresh: { limit: 30, ttl: 60_000 },
} as const;
