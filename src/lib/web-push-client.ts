"use client";

export type PushEnableResult =
  | { ok: true; reason: "subscribed" | "already-subscribed" }
  | { ok: false; reason: "unsupported" | "not-configured" | "denied" | "failed" };

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

async function persistSubscription(volunteerId: string, subscription: PushSubscription) {
  const json = subscription.toJSON();
  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ volunteerId, subscription: json }),
  });
  if (!response.ok) throw new Error("Failed to persist push subscription");
}

/** Must be called from a user gesture when permission has not yet been granted. */
export async function enableVolunteerPush(volunteerId: string): Promise<PushEnableResult> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return { ok: false, reason: "unsupported" };
  }
  try {
    const keyResponse = await fetch("/api/push/public-key");
    const keyJson = (await keyResponse.json()) as { configured?: boolean; publicKey?: string | null };
    if (!keyJson.configured || !keyJson.publicKey) {
      return { ok: false, reason: "not-configured" };
    }

    const permission =
      Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
    if (permission !== "granted") return { ok: false, reason: "denied" };

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    const existed = Boolean(subscription);
    subscription ??= await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(keyJson.publicKey),
    });
    await persistSubscription(volunteerId, subscription);
    return { ok: true, reason: existed ? "already-subscribed" : "subscribed" };
  } catch (error) {
    console.error("[push-client]", error);
    return { ok: false, reason: "failed" };
  }
}

export async function hasPushSubscription(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  try {
    return Boolean(await (await navigator.serviceWorker.ready).pushManager.getSubscription());
  } catch {
    return false;
  }
}
