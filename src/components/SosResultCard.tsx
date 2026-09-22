"use client";

/**
 * Live AI triage result shown to the victim after their voice SOS —
 * color-coded by urgency, with trust score, verification layer breakdown
 * and volunteer match summary.
 */
import { motion } from "framer-motion";
import { ShieldCheck, ShieldAlert, Users, ChevronDown, Image as ImageIcon, CloudRain, Radio } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { EMERGENCY_META, severityTone, type EmergencyType } from "@/lib/constants";
import { cn, formatMeters } from "@/lib/utils";
import type { TriageResult } from "@/lib/gemini";
import type { VerificationReport } from "@/lib/verification";
import type { MatchedVolunteer } from "@/lib/matching";

export interface SosResult {
  triage: TriageResult;
  verification: VerificationReport;
  matched: MatchedVolunteer[];
  notifications?: Array<{
    volunteerId: string;
    delivered: boolean;
    provider: "web-push" | "in-app";
    attempted: number;
  }>;
  storageWarning?: string | null;
}

export default function SosResultCard({ result }: { result: SosResult }) {
  const [expanded, setExpanded] = React.useState(false);
  const meta = EMERGENCY_META[result.triage.emergency_type as EmergencyType] ?? EMERGENCY_META.other;
  const tone = severityTone(result.triage.severity);
  const v = result.verification;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className="w-full overflow-hidden rounded-2xl border bg-[#0e1730]/90 backdrop-blur"
      style={{ borderColor: `${meta.color}55`, boxShadow: `0 20px 60px -20px ${meta.color}55` }}
      aria-live="polite"
    >
      {/* urgency strip */}
      <div className="flex items-center justify-between px-4 py-3" style={{ background: meta.soft }}>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full" style={{ background: meta.color }} />
          <p className="font-display text-sm font-bold uppercase tracking-widest" style={{ color: meta.color }}>
            {meta.label} · {tone.label}
          </p>
        </div>
        <Badge variant={v.isFake ? "red" : v.isVerified ? "green" : "amber"}>
          {v.isFake ? (
            <><ShieldAlert className="h-3 w-3" /> Flagged fake</>
          ) : v.isVerified ? (
            <><ShieldCheck className="h-3 w-3" /> AI verified</>
          ) : (
            "Verifying"
          )}
        </Badge>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <p className="text-sm leading-relaxed text-slate-300">{result.triage.summary}</p>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white/[0.04] p-2.5">
            <p className={cn("font-display text-2xl font-bold", tone.cls.split(" ")[0])}>{result.triage.severity}<span className="text-xs text-slate-500">/10</span></p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Severity</p>
          </div>
          <div className="rounded-xl bg-white/[0.04] p-2.5">
            <p className="font-display text-2xl font-bold text-slate-100">{v.trustScore}<span className="text-xs text-slate-500">%</span></p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Trust</p>
          </div>
          <div className="rounded-xl bg-white/[0.04] p-2.5">
            <p className="font-display text-2xl font-bold uppercase text-slate-100">{result.triage.language_detected}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Language</p>
          </div>
        </div>

        {/* volunteer matches */}
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] px-3 py-2.5">
          <Users className="h-4 w-4 shrink-0 text-emerald-300" />
          <p className="text-xs font-semibold text-emerald-200">
            {result.matched.length > 0 ? (
              <>
                {result.matched.length} volunteer{result.matched.length > 1 ? "s" : ""} alerted within 2km
                {result.matched[0] && ` — nearest ${formatMeters(result.matched[0].distanceMeters)} away`}
              </>
            ) : (
              "No volunteers in range yet — Command Center has been notified"
            )}
          </p>
        </div>

        {/* verification layer breakdown */}
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex cursor-pointer items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-300"
          aria-expanded={expanded}
        >
          Why this trust score? (3-layer AI check)
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
        </button>
        {expanded && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="flex flex-col gap-2 text-xs">
            <div className="flex gap-2 rounded-lg bg-white/[0.03] p-2.5">
              <CloudRain className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" />
              <p className="text-slate-400"><span className="font-bold text-slate-300">Weather cross-check: </span>{v.notes.layerB.note}</p>
            </div>
            <div className="flex gap-2 rounded-lg bg-white/[0.03] p-2.5">
              <Radio className="mt-0.5 h-3.5 w-3.5 shrink-0 text-purple-400" />
              <p className="text-slate-400"><span className="font-bold text-slate-300">Crowd clustering: </span>{v.notes.layerC.note}</p>
            </div>
            {v.notes.layerA && (
              <div className="flex gap-2 rounded-lg bg-white/[0.03] p-2.5">
                <ImageIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                <p className="text-slate-400"><span className="font-bold text-slate-300">Image vision: </span>{v.notes.layerA.reasoning}</p>
              </div>
            )}
          </motion.div>
        )}

        <p className="text-center text-[10px] uppercase tracking-widest text-slate-600">
          Analyzed by {result.triage.source === "gemini" ? "Gemini 2.5 Flash" : "resilient fallback AI"} · Help is on the way
        </p>
      </div>
    </motion.div>
  );
}
