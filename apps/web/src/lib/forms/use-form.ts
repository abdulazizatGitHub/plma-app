"use client";

import { useCallback, useMemo, useState } from "react";

type Rules<T> = { [K in keyof T]?: (value: T[K], values: T) => string | null };

/**
 * Minimal form state for every form in the app.
 *  - `isValid` drives `disabled` on the submit button (owner rule).
 *  - Errors show after a field is blurred, or after a submit attempt.
 */
export function useForm<T extends Record<string, string | boolean>>(initial: T, rules: Rules<T>) {
  const [values, setValues] = useState<T>(initial);
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  const errors = useMemo(() => {
    const out: Partial<Record<keyof T, string>> = {};
    for (const key of Object.keys(rules) as (keyof T)[]) {
      const msg = rules[key]?.(values[key], values);
      if (msg) out[key] = msg;
    }
    return out;
    // Rules are declared inline by callers; values are the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values]);

  const isValid = Object.keys(errors).length === 0;

  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
  }, []);

  const touch = useCallback((key: keyof T) => setTouched((t) => ({ ...t, [key]: true })), []);

  /** Error to display for a field: only once touched or after a submit attempt. */
  const shownError = (key: keyof T) => (touched[key] || submitted ? (errors[key] ?? null) : null);

  /** Props for a text input: value, onChange, onBlur, error. */
  const field = (key: keyof T) => ({
    value: String(values[key]),
    onChange: (e: { target: { value: string } }) => set(key, e.target.value as T[keyof T]),
    onBlur: () => touch(key),
    error: shownError(key),
  });

  return {
    values,
    errors,
    isValid,
    set,
    touch,
    field,
    shownError,
    /** Call at the top of onSubmit; returns true when it's OK to proceed. */
    attempt: () => {
      setSubmitted(true);
      return isValid;
    },
    reset: (next: T = initial) => {
      setValues(next);
      setTouched({});
      setSubmitted(false);
    },
  };
}
