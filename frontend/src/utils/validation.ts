export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isEmail = (value: string): boolean => EMAIL_RE.test(value);

// Shared password policy: 8–10 characters, must include an uppercase letter,
// a lowercase letter, a digit, and a special character.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 10;

export function passwordError(password: string): string | null {
  if (!password) return 'Password is required.';
  if (
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH
  ) {
    return 'Password must be 8–10 characters long.';
  }
  if (
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    return 'Password must include uppercase, lowercase, a number, and a special character.';
  }
  return null;
}
