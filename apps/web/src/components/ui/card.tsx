import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className = "", ...props }: CardProps) {
  return (
    <div
      className={`transition-token shadow-card rounded-(--radius-card) border border-line/50 bg-surface p-4 ${className}`}
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
