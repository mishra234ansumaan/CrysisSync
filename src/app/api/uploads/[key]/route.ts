/**
 * Secure same-origin proxy for private Supabase Storage evidence objects.
 * The storage bucket stays private and the service-role key stays server-side.
 */
import { NextResponse } from "next/server";
import { getEvidenceObject } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await context.params;
    const object = await getEvidenceObject(key);
    return new NextResponse(Buffer.from(object.bytes), {
      status: 200,
      headers: {
        "Content-Type": object.contentType,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[uploads/get]", error);
    return NextResponse.json({ error: "evidence not found" }, { status: 404 });
  }
}
