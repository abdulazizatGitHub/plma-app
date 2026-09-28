type DotClusterProps = {
  completed: number;
  total: number;
  className?: string;
};

/** A row of small filled/outline dots — used where a count (e.g. 3/5 prayers) is more glanceable as shape than as text. */
export function DotCluster({ completed, total, className = "" }: DotClusterProps) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full ${
            i < completed ? "bg-success" : "border border-line"
          }`}
        />
      ))}
    </span>
  );
}
