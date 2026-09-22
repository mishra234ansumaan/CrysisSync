/**
 * FEATURE 3 — AI Fake Detection Engine
 * Combines three verification layers into one trust_score (0-100):
 *   Layer A · Gemini Vision image analysis (if photo attached)
 *   Layer B · OpenWeatherMap weather cross-check
 *   Layer C · Crowd clustering (≥3 reports / 500m / 10min ⇒ auto-verify)
 */
import { getWeather, weatherConsistency } from "./weather";
import { verifyImage, type ImageVerdict } from "./gemini";
import { countWithin, type LatLng } from "./geo";

export interface VerificationReport {
  trustScore: number;
  isVerified: boolean;
  isFake: boolean;
  notes: {
    layerA?: ImageVerdict;
    layerB: { verdict: string; note: string };
    layerC: { nearbyCount: number; note: string };
  };
}

export async function runVerificationLayers(opts: {
  emergencyType: string;
  lat: number;
  lng: number;
  imageDataUrl?: string | null;
  imageFileName?: string;
  /** Recent reports in the area for crowd corroboration (includes this one). */
  recentReports: LatLng[];
}): Promise<VerificationReport> {
  const { emergencyType, lat, lng, imageDataUrl, imageFileName, recentReports } = opts;

  // ── Layer A: Vision ─────────────────────────────────────────────────────
  let layerA: ImageVerdict | undefined;
  if (imageDataUrl) {
    layerA = await verifyImage(imageDataUrl, emergencyType, imageFileName ?? "");
  }

  // ── Layer B: Weather cross-check ────────────────────────────────────────
  const weather = await getWeather(lat, lng);
  const layerB = weatherConsistency(emergencyType, weather);

  // ── Layer C: Crowd clustering (500m / recent window queried by caller) ──
  const nearbyCount = countWithin({ lat, lng }, recentReports, 500);
  const layerC = {
    nearbyCount,
    note:
      nearbyCount >= 3
        ? `${nearbyCount} independent reports within 500m/10min — crowd-verified.`
        : nearbyCount === 2
          ? `2 reports in area — partial corroboration (+15 trust).`
          : `Single report in area — base confidence 30%.`,
  };

  // ── Composite trust score ───────────────────────────────────────────────
  let score = 30;
  if (nearbyCount >= 3) score += 40;
  else if (nearbyCount === 2) score += 15;

  if (layerB.verdict === "consistent") score += 15;
  else if (layerB.verdict === "suspicious") score -= 20;

  if (layerA) score += layerA.is_real ? Math.round(layerA.confidence * 0.25) : -45;

  const trustScore = Math.max(0, Math.min(100, score));
  return {
    trustScore,
    isVerified: trustScore >= 70,
    isFake: trustScore <= 20 || Boolean(layerA && !layerA.is_real && layerA.confidence <= 25),
    notes: { layerA, layerB: { verdict: layerB.verdict, note: layerB.note }, layerC },
  };
}
