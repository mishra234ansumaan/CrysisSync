/** Offline QR profile cloud mirror — Supabase PostgreSQL in production. */
import { NextResponse } from "next/server";
import { cuid } from "@/lib/utils";
import { getMedicalProfile, upsertMedicalProfile } from "@/lib/repository";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      userId?: string;
      name?: string;
      bloodGroup?: string;
      allergies?: string;
      conditions?: string;
      emergencyContact?: string;
    };
    if (!body.userId || !body.name || !body.bloodGroup || !body.emergencyContact) {
      return NextResponse.json({ error: "userId, name, bloodGroup, emergencyContact required" }, { status: 400 });
    }
    const existing = await getMedicalProfile(body.userId);
    const profile = await upsertMedicalProfile({
      id: existing?.id ?? cuid(),
      userId: body.userId,
      name: body.name.slice(0, 100),
      bloodGroup: body.bloodGroup.slice(0, 4),
      allergies: body.allergies?.slice(0, 500) || null,
      conditions: body.conditions?.slice(0, 1000) || null,
      emergencyContact: body.emergencyContact.slice(0, 100),
      updatedAt: new Date(),
    });
    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    console.error("[medical POST]", error);
    return NextResponse.json({ error: "save failed" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const userId = new URL(req.url).searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  return NextResponse.json({ ok: true, profile: await getMedicalProfile(userId) });
}
