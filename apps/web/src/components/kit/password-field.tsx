"use client";

import { Check, Eye, EyeOff, X } from "lucide-react";
import { useState, type InputHTMLAttributes } from "react";
import { passwordRules, passwordStrength } from "@/lib/forms/validators";
import { TextField } from "./text-field";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  value: string;
  error?: string | null;
  hint?: string;
  /** Live rule checklist + strength bar (new passwords only). */
  showRules?: boolean;
};

const STRENGTH = ["", "Weak", "Fair", "Good", "Strong"];
const STRENGTH_FILL = ["", "bg-todo", "bg-progress", "bg-primary", "bg-done"];

/** Password input with a show/hide toggle and, for new passwords, a live checklist. */
export function PasswordField({ label, value, error, hint, showRules = false, ...input }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const strength = passwordStrength(value);
  return (
    <div>
      <TextField
        label={label}
        type={visible ? "text" : "password"}
        value={value}
        error={error}
        hint={hint}
        trailing={
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-track hover:text-ink"
          >
            {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          </button>
        }
        {...input}
      />
      {/* Rules appear once typing starts, so the empty form fits one phone screen. */}
      {showRules && value ? (
        <div className="mt-1.5 space-y-1.5" aria-live="polite">
          <div className="flex items-center gap-2">
            <div className="flex flex-1 gap-1" aria-hidden>
              {[1, 2, 3, 4].map((i) => (
                <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= strength ? STRENGTH_FILL[strength] : "bg-track"}`} />
              ))}
            </div>
            <span className="w-14 text-right text-[12px] text-ink-2">{STRENGTH[strength]}</span>
          </div>
          <ul className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11.5px]">
            {passwordRules(value).map((r) => (
              <li key={r.id} className={`flex items-center gap-1.5 ${r.ok ? "text-ink" : "text-ink-2"}`}>
                {r.ok ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-ink" strokeWidth={3} aria-hidden />
                ) : (
                  <X className="h-3.5 w-3.5 shrink-0" aria-hidden />
                )}
                <span>
                  {r.label}
                  <span className="sr-only">{r.ok ? " — done" : " — missing"}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
