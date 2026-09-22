/**
 * GET /api/weather/check?lat=..&lng=.. — Feature 3 Layer B weather cross-check.
 */
import { NextResponse } from "next/server";
import { getWeather } from "@/lib/weather";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat & lng required" }, { status: 400 });
  }
  const weather = await getWeather(lat, lng);
  return NextResponse.json({ ok: true, weather });
}
