/** Lowercases, strips non-alphanumerics to hyphens, trims leading/trailing hyphens. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** A slug plus a short random suffix, to keep per-user slugs unique without a DB round-trip. */
export function uniqueSlug(input: string, suffixSource: string): string {
  const base = slugify(input) || "habit";
  return `${base}-${suffixSource.replace(/-/g, "").slice(0, 8)}`;
}
