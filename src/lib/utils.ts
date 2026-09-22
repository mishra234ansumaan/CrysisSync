import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind class combiner (shadcn-style). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** cuid-like collision-resistant id without an extra dependency. */
export function cuid(): string {
  const t = Date.now().toString(36);
  const rand = Array.from({ length: 12 }, () =>
    Math.floor(Math.random() * 36).toString(36)
  ).join("");
  return `c${t}${rand}`;
}

export function timeAgo(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const s = Math.max(1, Math.floor((Date.now() - d.getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function formatMeters(m: number): string {
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

/** Safe JSON parse with fallback — used to parse LLM output. */
export function safeJson<T>(raw: string, fallback: T): T {
  try {
    // LLMs often wrap JSON in ```json fences or add prose — extract the object.
    const match = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : raw) as T;
  } catch {
    return fallback;
  }
}
