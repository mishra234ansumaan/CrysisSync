import { NextResponse } from "next/server";
import { upsertPushSubscription } from "@/lib/repository";
import { cuid } from "@/lib/utils";
import { enforceRateLimit } from "@/lib/rate-limit";

interface SubscriptionBody {
  volunteerId?: string;
  subscription?: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
}

/** Persist a browser Push API subscription for a volunteer device. */
export async function POST(request: Request) {
  try {
    const limit = await enforceRateLimit(request, "push-subscribe", 20, 60 * 60_000);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Push subscription quota reached" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
    }
    const body = (await request.json()) as SubscriptionBody;
    const endpoint = body.subscription?.endpoint;
    const p256dh = body.subscription?.keys?.p256dh;
    const auth = body.subscription?.keys?.auth;
    if (!body.volunteerId || !endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: "invalid push subscription" }, { status: 400 });
    }
    const url = new URL(endpoint);
    if (url.protocol !== "https:") {
      return NextResponse.json({ error: "push endpoint must use HTTPS" }, { status: 400 });
    }
    await upsertPushSubscription({
      id: cuid(),
      volunteerId: body.volunteerId.slice(0, 100),
      endpoint: endpoint.slice(0, 2000),
      p256dh: p256dh.slice(0, 500),
      auth: auth.slice(0, 500),
      createdAt: new Date(),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[push/subscribe]", error);
    return NextResponse.json({ error: "subscription failed" }, { status: 500 });
  }
}
