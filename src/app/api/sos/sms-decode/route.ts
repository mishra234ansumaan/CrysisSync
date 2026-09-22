/**
 * POST /api/sos/sms-decode — Feature 2: offline SMS fallback.
 * Parses micro-codes of the form:  SOS#{lat}#{lng}#{type}#{severity}
 * e.g. "SOS#17.3850#78.4867#flood#8"
 * Then ingests it through the SAME pipeline as a voice SOS.
 */
import { NextResponse } from "next/server";
import { createSosReport } from "@/lib/sos-service";
import type { EmergencyType } from "@/lib/constants";

const CODE_RE = /^SOS#(-?\d+(?:\.\d+)?)#(-?\d+(?:\.\d+)?)#(flood|fire|medical|earthquake|other)#(10|[1-9])$/i;

export function parseSosCode(code: string) {
  const m = code.trim().match(CODE_RE);
  if (!m) return null;
  return {
    lat: Number(m[1]),
    lng: Number(m[2]),
    emergencyType: m[3].toLowerCase() as EmergencyType,
    severity: Number(m[4]),
  };
}

export async function POST(req: Request) {
  try {
    const { code, userId } = (await req.json()) as { code?: string; userId?: string };
    if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });
    const parsed = parseSosCode(code);
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid SOS micro-code. Expected SOS#{lat}#{lng}#{type}#{severity}" },
        { status: 422 }
      );
    }
    const result = await createSosReport({
      transcript: `SMS micro-code decoded: ${code.trim()}`,
      lat: parsed.lat,
      lng: parsed.lng,
      userId,
      source: "sms",
      presetType: parsed.emergencyType,
      presetSeverity: parsed.severity,
    });
    return NextResponse.json({ ok: true, decoded: parsed, ...result });
  } catch (err) {
    console.error("[sos/sms-decode]", err);
    return NextResponse.json({ error: "decode failed" }, { status: 500 });
  }
}
