import { afterQuiet } from "@life/shared";
import type { PushSender, PushTarget } from "../reminders/service.js";
import type { Db } from "./privacy.js";

/**
 * A social notification (a share, kudos, a friend request) to every device of
 * one user. Skipped when their notifications are off or it's their quiet
 * hours — it still waits in Activity.
 */
export async function pushToUser(sql: Db, send: PushSender | null, userId: string, msg: { title: string; body: string; url: string; tag: string }, now = new Date()) {
  if (!send) return 0;
  const [s] = await sql<{ notifications_enabled: boolean | null; quiet_from: string | null; quiet_to: string | null; timezone: string | null }[]>`
    SELECT notifications_enabled, quiet_from, quiet_to, timezone FROM user_settings WHERE user_id = ${userId}`;
  if (s && s.notifications_enabled === false) return 0;
  if (s?.quiet_from && s.quiet_to && afterQuiet(now, { quietFrom: s.quiet_from, quietTo: s.quiet_to, timezone: s.timezone ?? "Asia/Karachi" }).getTime() !== now.getTime()) return 0;
  const subs = await sql<(PushTarget & { id: string })[]>`SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ${userId}`;
  const payload = JSON.stringify({ title: msg.title, body: msg.body, tag: msg.tag, url: msg.url, token: null });
  let ok = 0;
  for (const sub of subs) {
    const result = await send(sub, payload);
    if (result === "ok") {
      ok += 1;
      await sql`UPDATE push_subscriptions SET failures = 0, last_success_at = now() WHERE id = ${sub.id}`;
    } else if (result === "gone") await sql`DELETE FROM push_subscriptions WHERE id = ${sub.id}`;
    else await sql`UPDATE push_subscriptions SET failures = failures + 1 WHERE id = ${sub.id}`;
  }
  return ok;
}
