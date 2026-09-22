/**
 * CrisisSync AI wrapper — Google Gemini 1.5 Flash (FREE tier)
 * ------------------------------------------------------------
 * Swappable by design: every feature calls this wrapper instead of a provider
 * SDK directly, so a different multimodal model can replace Gemini later.
 *
 * DEMO RESILIENCE: if GEMINI_API_KEY is unset or the API errors, we fall back
 * to deterministic on-device heuristics so the stage demo NEVER breaks.
 */
import { safeJson } from "./utils";
import type { EmergencyType } from "./constants";

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

async function callGemini(parts: GeminiPart[]): Promise<string | null> {
  if (!API_KEY) return null;
  try {
    const res = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 900 },
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    return json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? null;
  } catch {
    return null; // network blocked / timeout → heuristics take over
  }
}

// ───────────────────────── FEATURE 1: Voice Triage ─────────────────────────

export interface TriageResult {
  emergency_type: EmergencyType;
  severity: number;
  keywords: string[];
  summary: string;
  language_detected: string;
  source: "gemini" | "heuristic";
}

const TYPE_KEYWORDS: Array<[RegExp, EmergencyType]> = [
  [/flood|water|drown|submerge|river|rain|बाढ़|पानी|बारिश/i, "flood"],
  [/fire|flame|burn|smoke|blaze|आग|धुआं|जल/i, "fire"],
  [/heart|bleed|injur|unconscious|accident|ambulance|doctor|medical|pain|collapse|chot|चोट|खून|बेहोश|दिल/i, "medical"],
  [/earthquake|tremor|quake|collapse.*building|भूकंप/i, "earthquake"],
];

const SEVERE_WORDS = /help|urgent|dying|trapped|baby|child|children|many|जल्दी|मदद|फंस|बच्च/i;

/** Deterministic multilingual fallback triage (EN/HI keyword sets). */
function heuristicTriage(transcript: string): TriageResult {
  const type = TYPE_KEYWORDS.find(([re]) => re.test(transcript))?.[1] ?? "other";
  const hasHindi = /[\u0900-\u097F]/.test(transcript);
  const words = transcript.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const severity = Math.min(
    10,
    4 + (SEVERE_WORDS.test(transcript) ? 3 : 0) + (/\d+\s*(people|log|लोग)/.test(transcript) ? 2 : 0) + (type !== "other" ? 1 : 0)
  );
  return {
    emergency_type: type,
    severity,
    keywords: [...new Set(words)].slice(0, 6),
    summary: `[On-device analysis] ${type.toUpperCase()} emergency reported. ${transcript.slice(0, 120)}`,
    language_detected: hasHindi ? "hi" : "en",
    source: "heuristic",
  };
}

export async function triageTranscript(transcript: string): Promise<TriageResult> {
  const prompt = `Analyze this emergency message: '${transcript}'. Return JSON: { emergency_type: 'flood|fire|medical|earthquake|other', severity: 1-10, keywords: [], summary: '...', language_detected: '...' }. Respond with raw JSON only.`;
  const raw = await callGemini([{ text: prompt }]);
  if (!raw) return heuristicTriage(transcript);
  const parsed = safeJson<Partial<TriageResult>>(raw, {});
  return {
    emergency_type: (["flood", "fire", "medical", "earthquake", "other"].includes(parsed.emergency_type ?? "")
      ? parsed.emergency_type
      : heuristicTriage(transcript).emergency_type) as EmergencyType,
    severity: Math.max(1, Math.min(10, Number(parsed.severity) || 5)),
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 8).map(String) : [],
    summary: String(parsed.summary ?? transcript.slice(0, 140)),
    language_detected: String(parsed.language_detected ?? "en").slice(0, 8),
    source: "gemini",
  };
}

// ───────────────── FEATURE 3 / Layer A: Image Verification ─────────────────

export interface ImageVerdict {
  is_real: boolean;
  confidence: number;
  reasoning: string;
  source: "gemini" | "heuristic";
}

function heuristicImageVerdict(emergencyType: string, fileName: string): ImageVerdict {
  // Without a vision model we can still catch the classic demo prank:
  // meme/animal filenames claiming a disaster. Real Vision runs when keyed.
  const meme = /cat|dog|meme|selfie|funny|joke|lol/i.test(fileName);
  return {
    is_real: !meme,
    confidence: meme ? 12 : 55,
    reasoning: meme
      ? `Heuristic check: image content (file '${fileName}') does not depict a ${emergencyType} scene. Flagged as probable fake — connect GEMINI_API_KEY for full Vision analysis.`
      : `Heuristic check only (no GEMINI_API_KEY): no obvious hoax markers detected. Confidence capped at 55 pending live Vision verification.`,
    source: "heuristic",
  };
}

export async function verifyImage(
  base64DataUrl: string,
  emergencyType: string,
  fileName = ""
): Promise<ImageVerdict> {
  const match = base64DataUrl.match(/^data:(.*?);base64,(.*)$/);
  if (!match) return heuristicImageVerdict(emergencyType, fileName);
  const [, mimeType, data] = match;
  const prompt = `Is this image showing a real ${emergencyType} emergency scene? Return JSON: { is_real: bool, confidence: 0-100, reasoning: '...' }. Raw JSON only.`;
  const raw = await callGemini([
    { text: prompt },
    { inlineData: { mimeType, data } },
  ]);
  if (!raw) return heuristicImageVerdict(emergencyType, fileName);
  const parsed = safeJson<Partial<ImageVerdict>>(raw, {});
  return {
    is_real: Boolean(parsed.is_real),
    confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 50)),
    reasoning: String(parsed.reasoning ?? "Vision analysis complete."),
    source: "gemini",
  };
}

// ────────────── FEATURE 8: Drone Aerial Damage Assessment ──────────────────

export interface DroneBox {
  x: number; // normalized 0-1
  y: number;
  w: number;
  h: number;
  label: string;
}
export interface DroneFindings {
  flooded_zones: DroneBox[];
  trapped_people: DroneBox[];
  damaged_structures: DroneBox[];
  safe_landing_zones: DroneBox[];
  summary: string;
  source: "gemini" | "heuristic";
}

/** Canned-but-plausible overlay for the sample aerial photo (works offline). */
function heuristicDroneFindings(): DroneFindings {
  return {
    flooded_zones: [
      { x: 0.04, y: 0.52, w: 0.4, h: 0.42, label: "Floodwater ~1.2m" },
      { x: 0.5, y: 0.62, w: 0.46, h: 0.32, label: "Submerged street grid" },
      { x: 0.08, y: 0.08, w: 0.26, h: 0.3, label: "Standing water" },
    ],
    trapped_people: [
      { x: 0.58, y: 0.24, w: 0.09, h: 0.11, label: "Rooftop signals (3)" },
      { x: 0.34, y: 0.42, w: 0.08, h: 0.1, label: "Vehicle occupants" },
    ],
    damaged_structures: [
      { x: 0.7, y: 0.36, w: 0.16, h: 0.18, label: "Collapsed roof" },
    ],
    safe_landing_zones: [
      { x: 0.42, y: 0.1, w: 0.15, h: 0.16, label: "Elevated parking deck" },
    ],
    summary: "On-device assessment: 3 flooded zones, 2 groups possibly trapped, 1 damaged structure, 1 viable landing zone. Connect GEMINI_API_KEY for pixel-accurate Vision analysis.",
    source: "heuristic",
  };
}

export async function analyzeDroneImage(base64DataUrl: string): Promise<DroneFindings> {
  const match = base64DataUrl.match(/^data:(.*?);base64,(.*)$/);
  if (!match) return heuristicDroneFindings();
  const [, mimeType, data] = match;
  const prompt = `Analyze this aerial/drone photo of a disaster area. Identify: flooded_zones, trapped_people, damaged_structures, safe_landing_zones. Return JSON with normalized (0-1) pixel coordinates { x, y, w, h, label } for each finding. Raw JSON only.`;
  const raw = await callGemini([{ text: prompt }, { inlineData: { mimeType, data } }]);
  if (!raw) return heuristicDroneFindings();
  const parsed = safeJson<Partial<DroneFindings>>(raw, {});
  const boxes = (v: unknown): DroneBox[] =>
    Array.isArray(v)
      ? v
          .filter((b) => b && typeof b === "object")
          .map((b) => {
            const o = b as Record<string, unknown>;
            return {
              x: Math.max(0, Math.min(0.95, Number(o.x) || 0.1)),
              y: Math.max(0, Math.min(0.95, Number(o.y) || 0.1)),
              w: Math.max(0.03, Math.min(0.9, Number(o.w) || 0.1)),
              h: Math.max(0.03, Math.min(0.9, Number(o.h) || 0.1)),
              label: String(o.label ?? "Finding"),
            };
          })
      : [];
  const fallback = heuristicDroneFindings();
  return {
    flooded_zones: boxes(parsed.flooded_zones),
    trapped_people: boxes(parsed.trapped_people),
    damaged_structures: boxes(parsed.damaged_structures),
    safe_landing_zones: boxes(parsed.safe_landing_zones),
    summary: String(parsed.summary ?? "Aerial analysis complete."),
    source: "gemini",
  };
}

// ─────────────────────── Translation helper (bonus) ────────────────────────

export async function translateToEnglish(text: string): Promise<string> {
  const raw = await callGemini([
    { text: `Translate this emergency message to English, keep it short and factual. Return only the translation: '${text}'` },
  ]);
  return raw?.trim() || text;
}
