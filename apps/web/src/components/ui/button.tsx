import type { ButtonHTMLAttributes } from "react";

const variants = {
  primary:
    "bg-rose-400 text-white hover:bg-rose-500 active:bg-rose-600 shadow-sm shadow-rose-200/80",
  secondary:
    "bg-white text-rose-900 border border-rose-100 hover:bg-rose-50 active:bg-rose-100",
  ghost: "bg-transparent text-rose-700 hover:bg-rose-50 active:bg-rose-100",
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
      className={`inline-flex min-h-11 items-center justify-center rounded-2xl px-4 text-sm font-medium transition-colors disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
