/**
 * Standards-based Web Push notifications (no per-message provider fee).
 * VAPID keys identify this application; subscriptions live in PostgreSQL.
 */
import webpush from "web-push";
import {
  deletePushSubscription,
  listVolunteerPushSubscriptions,
} from "./repository";

export interface RescuePushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

function configureWebPush(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export function pushConfiguration() {
  return {
    configured: Boolean(
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
    ),
    provider: "web-push",
  } as const;
}

export async function sendVolunteerPush(
  volunteerId: string,
  payload: RescuePushPayload
): Promise<{ attempted: number; delivered: number }> {
  if (!configureWebPush()) return { attempted: 0, delivered: 0 };
  const subscriptions = await listVolunteerPushSubscriptions(volunteerId);
  let delivered = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify(payload),
          { TTL: 90, urgency: "high", topic: payload.tag?.slice(0, 32) }
        );
        delivered++;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await deletePushSubscription(subscription.endpoint);
        } else {
          console.error(`[web-push] delivery failed for ${volunteerId}`, error);
        }
      }
    })
  );

  return { attempted: subscriptions.length, delivered };
}
