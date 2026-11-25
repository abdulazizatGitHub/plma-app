/**
 * A mosque (dome, door and two minarets) in lucide's line style: 24px grid,
 * currentColor, 1.75 stroke, round joins. lucide has no mosque icon.
 */
export function MosqueIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      focusable="false"
    >
      <path d="M2.5 21h19" />
      <path d="M7 21v-6a5 5 0 0 1 10 0v6" />
      <path d="M12 10V7.5" />
      <path d="M10.5 21v-2.5a1.5 1.5 0 0 1 3 0V21" />
      <path d="M4 21V11.5l.75-1.5.75 1.5V21" />
      <path d="M18.5 21V11.5l.75-1.5.75 1.5V21" />
    </svg>
  );
}
