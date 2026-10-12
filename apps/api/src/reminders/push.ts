import webpush from "web-push";
import type { PushResult, PushSender } from "./service.js";

/** Web Push via VAPID. 404/410 = the browser dropped the subscription. */
export function webPushSender(keys: { publicKey: string; privateKey: string; subject: string }): PushSender {
  webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);
  return async (target, payload): Promise<PushResult> => {
    try {
      await webpush.sendNotification({ endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } }, payload, {
        TTL: 60 * 60,
        urgency: "high",
      });
      return "ok";
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      return status === 404 || status === 410 ? "gone" : "error";
    }
  };
}
