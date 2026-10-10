/*
 * Field validators shared by every form (owner rule: validate everything,
 * submit stays disabled until valid). Each returns an error message, or null
 * when the value is valid. Messages are short and say how to fix it.
 */

export type Validator<V = string> = (value: V) => string | null;

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export const required = (label: string): Validator => (v) => (v.trim() ? null : `${label} is required.`);

export const email: Validator = (v) => {
  const s = v.trim();
  if (!s) return "Email is required.";
  if (s.length > 254 || !EMAIL_RE.test(s)) return "Enter a valid email, like name@example.com.";
  return null;
};

export const fullName: Validator = (v) => {
  const s = v.trim();
  if (!s) return "Your name is required.";
  if (s.length < 2) return "Name must be at least 2 characters.";
  if (s.length > 60) return "Name must be 60 characters or fewer.";
  if (!/^[\p{L}][\p{L}\s.'-]*$/u.test(s)) return "Use letters, spaces, and . ' - only.";
  return null;
};

export type PasswordRule = { id: string; label: string; ok: boolean };

/** The live checklist shown under the password field (mirrors the Supabase password policy). */
export function passwordRules(v: string): PasswordRule[] {
  return [
    { id: "length", label: "At least 8 characters", ok: v.length >= 8 },
    { id: "upper", label: "One uppercase letter", ok: /[A-Z]/.test(v) },
    { id: "lower", label: "One lowercase letter", ok: /[a-z]/.test(v) },
    { id: "digit", label: "One number", ok: /\d/.test(v) },
    { id: "symbol", label: "One symbol (e.g. ! @ # $)", ok: /[^A-Za-z0-9\s]/.test(v) },
  ];
}

/** 0–4, for the strength bar. */
export function passwordStrength(v: string): number {
  if (!v) return 0;
  const passed = passwordRules(v).filter((r) => r.ok).length;
  return Math.min(4, Math.max(1, passed - 1 + (v.length >= 12 ? 1 : 0)));
}

export const newPassword: Validator = (v) => {
  if (!v) return "Password is required.";
  if (v.length > 72) return "Password must be 72 characters or fewer.";
  const missing = passwordRules(v).filter((r) => !r.ok);
  return missing.length ? `Password needs: ${missing.map((r) => r.label.toLowerCase()).join(", ")}.` : null;
};

/** Sign-in only checks presence — the server decides if it's right. */
export const existingPassword: Validator = (v) => (v ? null : "Password is required.");

export const confirmPassword =
  (password: string): Validator =>
  (v) =>
    !v ? "Please confirm your password." : v !== password ? "Passwords don't match." : null;

export const otpCode: Validator = (v) => (/^\d{6}$/.test(v) ? null : "Enter the 6-digit code from the email.");

export const taskTitle: Validator = (v) => {
  const s = v.trim();
  if (!s) return "Give it a name.";
  if (s.length > 200) return "Keep it under 200 characters.";
  return null;
};

/** A real calendar date in YYYY-MM-DD (rejects 2026-02-30). */
export const isoDate: Validator = (v) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return "Pick a date.";
  const [y, m, d] = v.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? null : "Pick a valid date.";
};

export const MAX_QUANTITY = 1_000_000;

/** Keeps digits only (owner rule: number fields accept numbers only). */
export const sanitizeDigits = (raw: string, maxLength = 7) => raw.replace(/\D/g, "").slice(0, maxLength);

export const quantity: Validator = (v) => {
  if (!v) return "Enter a number.";
  if (!/^\d+$/.test(v)) return "Numbers only.";
  return Number(v) > MAX_QUANTITY ? `Max ${MAX_QUANTITY.toLocaleString("en-US")}.` : null;
};

export const categoryName: Validator = (v) => {
  const t = v.trim();
  if (!t) return "Give the category a name.";
  return t.length > 60 ? "Keep it under 60 characters." : null;
};

/** A whole number between min and max (digits-only inputs). */
export const wholeNumber =
  (label: string, min: number, max: number): Validator =>
  (v) => {
    if (!v.trim()) return `${label} is required.`;
    if (!/^\d+$/.test(v)) return `${label} must be a whole number.`;
    const n = Number(v);
    return n < min || n > max ? `${label} must be between ${min.toLocaleString()} and ${max.toLocaleString()}.` : null;
  };

/** Optional end date that can't be before the start date. */
export const endNotBefore = (from: string, until: string): string | null =>
  from && until && until < from ? "The end date is before the start date." : null;
