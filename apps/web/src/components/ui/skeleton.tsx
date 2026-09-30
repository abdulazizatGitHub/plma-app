type SkeletonProps = {
  className?: string;
};

/** A pulsing placeholder shape — used while data is loading instead of an empty gap. */
export function Skeleton({ className = "" }: SkeletonProps) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}
