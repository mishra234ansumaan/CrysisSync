export { BLOOD_GROUPS } from "./constants";

/** Stable per-device victim id, generated once and kept in localStorage. */
export function cuidOrStable(): string {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem("crisissync_uid");
  if (!id) {
    id = `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      localStorage.setItem("crisissync_uid", id);
    } catch {
      /* private mode */
    }
  }
  return id;
}
