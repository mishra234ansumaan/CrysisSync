/** Create the private CrisisSync evidence bucket in Supabase Storage. */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "crisissync-evidence";
  if (!url || !serviceRole) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  const client = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: existing } = await client.storage.getBucket(bucket);
  if (!existing) {
    const { error } = await client.storage.createBucket(bucket, {
      public: false,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    });
    if (error) throw error;
    console.log(`✓ Created private Supabase Storage bucket: ${bucket}`);
  } else {
    const { error } = await client.storage.updateBucket(bucket, {
      public: false,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    });
    if (error) throw error;
    console.log(`✓ Supabase Storage bucket already exists and is private: ${bucket}`);
  }
}

main().catch((error) => {
  console.error("Supabase setup failed:", error);
  process.exit(1);
});
