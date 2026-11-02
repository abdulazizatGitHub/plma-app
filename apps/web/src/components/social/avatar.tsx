import { initials, type PublicPerson } from "@life/shared";

/** Initials on the person's pastel (no photos yet — owner, 2026-10-16). */
export function Avatar({ person, size = 36 }: { person: Pick<PublicPerson, "name" | "username" | "avatarColor">; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-ink"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38), background: `var(--cat-${person.avatarColor ?? "sky"})` }}
    >
      {initials(person.name, person.username)}
    </span>
  );
}

/** Name over @username. */
export function PersonLabel({ person }: { person: Pick<PublicPerson, "name" | "username"> }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[14px] font-medium text-ink">{person.name}</span>
      {person.username ? <span className="block truncate text-[12px] text-ink-2">@{person.username}</span> : null}
    </span>
  );
}
