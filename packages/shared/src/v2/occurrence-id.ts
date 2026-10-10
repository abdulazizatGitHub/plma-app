/**
 * Deterministic occurrence id for (item, date, slot). Two devices that both
 * touch the same day offline produce the same id, so their rows merge by
 * last-write-wins instead of colliding on the (item_id, date, slot) unique index.
 * UUIDv8 layout over SHA-256 (Web Crypto: browsers and Node 20+).
 */
export async function occurrenceIdFor(itemId: string, date: string, slot = ""): Promise<string> {
  const bytes = new Uint8Array(
    await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(`occ|${itemId}|${date}|${slot}`)),
  );
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes.subarray(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
