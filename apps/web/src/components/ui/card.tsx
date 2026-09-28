import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className = "", ...props }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}
      {...props}
    />
  );
}

export function CardTitle({
  className = "",
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={`text-sm font-semibold tracking-wide text-ink ${className}`}
      {...props}
    />
  );
}
