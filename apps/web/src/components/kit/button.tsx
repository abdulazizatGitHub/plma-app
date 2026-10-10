import type { ButtonHTMLAttributes } from "react";

const variants = {
  primary: "bg-primary-strong text-on-primary-strong hover:opacity-90",
  secondary: "bg-surface text-ink border border-border hover:bg-track",
  ghost: "bg-transparent text-ink-2 hover:bg-track hover:text-ink",
} as const;

const sizes = {
  sm: "min-h-8 px-3 text-[12px]",
  md: "min-h-10 px-4 text-[13px]",
  lg: "min-h-11 px-5 text-[14px]",
} as const;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

export function Button({
  className = "",
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`transition-token press-pop inline-flex items-center justify-center gap-2 rounded-(--radius-control) font-medium disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}
