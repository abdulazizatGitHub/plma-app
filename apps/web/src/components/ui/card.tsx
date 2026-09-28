import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className = "", ...props }: CardProps) {
  return (
    <div
      className={`rounded-3xl border border-rose-100/80 bg-white/90 p-4 shadow-sm shadow-rose-100/50 backdrop-blur-sm ${className}`}
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
      className={`text-sm font-semibold tracking-wide text-rose-900/90 ${className}`}
      {...props}
    />
  );
}
