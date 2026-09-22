/**
 * POST /api/demo/seed — "Seed Demo Data" button on /demo.
 * Body: { force?: boolean }
 */
import { NextResponse } from "next/server";
import { seedDatabase } from "@/lib/seed";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await seedDatabase(Boolean((body as { force?: boolean }).force));
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[demo/seed]", err);
    return NextResponse.json({ error: "seed failed" }, { status: 500 });
  }
}
