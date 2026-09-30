import type { ButtonHTMLAttributes } from "react";

const variants = {
  primary: "bg-accent text-accent-ink hover:opacity-90 active:opacity-80 shadow-sm",
  secondary:
    "bg-surface text-ink border border-line hover:bg-surface-sunken active:bg-surface-sunken",
  ghost: "bg-transparent text-ink-muted hover:bg-surface-sunken active:bg-surface-sunken",
} as const;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
};

export function Button({
  className = "",
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`transition-token press-pop inline-flex min-h-11 items-center justify-center rounded-(--radius-control) px-4 text-sm font-medium disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
