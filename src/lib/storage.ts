/**
 * Evidence storage adapter.
 *
 * Production: private Supabase Storage bucket.
 * Local development: /public/uploads filesystem.
 *
 * Browser clients only receive a same-origin `/api/uploads/[key]` URL; the
 * Supabase service-role key never leaves the server.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { promises as fs } from "fs";
import path from "path";
import { cuid } from "./utils";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "crisissync-evidence";

let cachedClient: SupabaseClient | null = null;

function supabaseAdmin(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) return null;
  cachedClient ??= createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return cachedClient;
}

function encodeKey(provider: "supabase" | "local", key: string): string {
  return Buffer.from(`${provider}:${key}`, "utf8").toString("base64url");
}

function decodeDataUrl(base64DataUrl: string) {
  const match = base64DataUrl.match(/^data:(.*?);base64,(.*)$/);
  if (!match) throw new Error("Invalid image data URL");
  const [, mime, data] = match;
  if (!ALLOWED_IMAGE_TYPES.has(mime)) throw new Error(`Unsupported image type: ${mime}`);
  const buffer = Buffer.from(data, "base64");
  if (buffer.byteLength > MAX_IMAGE_BYTES) throw new Error("Evidence image exceeds 5 MB");
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  return { mime, buffer, ext };
}

export function storageConfiguration() {
  return {
    provider: supabaseAdmin() ? "supabase-storage" : "local-filesystem",
    configured: Boolean(supabaseAdmin()),
    bucket: supabaseAdmin() ? BUCKET : undefined,
  } as const;
}

export async function uploadEvidenceImage(
  base64DataUrl: string,
  prefix = "sos"
): Promise<string> {
  const { mime, buffer, ext } = decodeDataUrl(base64DataUrl);
  const objectPath = `${prefix}/${new Date().toISOString().slice(0, 10)}/${cuid()}.${ext}`;
  const supabase = supabaseAdmin();

  if (supabase) {
    const { error } = await supabase.storage.from(BUCKET).upload(objectPath, buffer, {
      contentType: mime,
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`);
    return `/api/uploads/${encodeKey("supabase", objectPath)}`;
  }

  // Vercel has an ephemeral filesystem; require Supabase when not on localhost.
  if (process.env.VERCEL) {
    throw new Error("Supabase Storage is not configured");
  }
  const key = `${prefix}-${cuid()}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, key), buffer);
  return `/uploads/${key}`;
}

export async function getEvidenceObject(encodedKey: string) {
  const decoded = Buffer.from(encodedKey, "base64url").toString("utf8");
  const separator = decoded.indexOf(":");
  if (separator < 1) throw new Error("Invalid evidence key");
  const provider = decoded.slice(0, separator);
  const objectPath = decoded.slice(separator + 1);
  if (!objectPath || objectPath.includes("..")) throw new Error("Invalid evidence path");

  if (provider === "supabase") {
    const supabase = supabaseAdmin();
    if (!supabase) throw new Error("Supabase Storage is not configured");
    const { data, error } = await supabase.storage.from(BUCKET).download(objectPath);
    if (error || !data) throw new Error(error?.message ?? "Evidence not found");
    return {
      bytes: new Uint8Array(await data.arrayBuffer()),
      contentType: data.type || "application/octet-stream",
      etag: undefined,
    };
  }

  if (provider === "local") {
    const file = await fs.readFile(path.join(process.cwd(), "public", "uploads", path.basename(objectPath)));
    return { bytes: new Uint8Array(file), contentType: "application/octet-stream", etag: undefined };
  }

  throw new Error("Unknown evidence provider");
}
