/** Volunteer onboarding persisted to Supabase PostgreSQL in production. */
import { NextResponse } from "next/server";
import { cuid } from "@/lib/utils";
import { DEFAULT_RESOURCES, type VolunteerResources } from "@/lib/constants";
import { listVolunteers, putVolunteer } from "@/lib/repository";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    const limit = await enforceRateLimit(req, "volunteer-register", 6, 60 * 60_000);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Registration quota reached" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
    }
    const body = (await req.json()) as {
      name?: string;
      phone?: string;
      lat?: number;
      lng?: number;
      resources?: Partial<VolunteerResources>;
    };
    if (!body.name || !body.phone || typeof body.lat !== "number" || typeof body.lng !== "number") {
      return NextResponse.json({ error: "name, phone, lat, lng required" }, { status: 400 });
    }
    const volunteer = await putVolunteer({
      id: cuid(),
      name: body.name.slice(0, 80),
      phone: body.phone.slice(0, 24),
      latitude: body.lat,
      longitude: body.lng,
      resources: JSON.stringify({ ...DEFAULT_RESOURCES, ...(body.resources ?? {}) }),
      isAvailable: true,
      createdAt: new Date(),
    });
    return NextResponse.json({ ok: true, volunteer });
  } catch (error) {
    console.error("[volunteer/register]", error);
    return NextResponse.json({ error: "registration failed" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, volunteers: await listVolunteers() });
}
