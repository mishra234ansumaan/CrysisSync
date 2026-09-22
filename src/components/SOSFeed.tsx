"use client";

/**
 * Live feed of incoming SOS reports for the Command Center sidebar.
 */
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, ShieldAlert, Clock, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EMERGENCY_META, severityTone, type EmergencyType } from "@/lib/constants";
import { timeAgo, cn } from "@/lib/utils";
import type { SOSReport } from "@/lib/models";

interface SOSFeedProps {
  reports: SOSReport[];
  loading?: boolean;
  selectedId?: string | null;
  onSelect?: (r: SOSReport) => void;
}

export default function SOSFeed({ reports, loading, selectedId, onSelect }: SOSFeedProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2" aria-label="Loading reports">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">
        No reports match the current filters.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2" aria-label="Incoming SOS reports">
      <AnimatePresence initial={false}>
        {reports.map((r) => {
          const meta = (EMERGENCY_META as Record<string, (typeof EMERGENCY_META)["flood"]>)[r.emergencyType] ?? EMERGENCY_META.other;
          const tone = severityTone(r.severity);
          const selected = selectedId === r.id;
          return (
            <motion.li
              key={r.id}
              layout
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            >
              <button
                onClick={() => onSelect?.(r)}
                aria-pressed={selected}
                className={cn(
                  "w-full cursor-pointer rounded-2xl border p-3.5 text-left transition-all duration-200",
                  selected
                    ? "border-cyan-400/50 bg-cyan-400/[0.07] shadow-[0_0_30px_-8px_rgba(34,211,238,.4)]"
                    : "border-white/[0.07] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]",
                  r.isFake && "opacity-60"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: meta.soft, color: meta.color }}
                    >
                      <Zap className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-bold capitalize text-slate-100">
                        {(EMERGENCY_META[r.emergencyType as EmergencyType] ?? EMERGENCY_META.other).label}
                        <span className={cn("ml-2 rounded px-1.5 py-0.5 text-[10px] font-black", tone.cls, "border")}>
                          SEV {r.severity}
                        </span>
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                        <Clock className="h-3 w-3" /> {timeAgo(r.createdAt)}
                        <span className="text-slate-600">·</span>
                        {r.source === "beacon" ? "BATTERY BEACON" : r.source.toUpperCase()}
                        {r.status !== "active" && (
                          <>
                            <span className="text-slate-600">·</span>
                            <span className="uppercase text-slate-400">{r.status}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  {r.isFake ? (
                    <Badge variant="red"><ShieldAlert className="h-3 w-3" /> Fake</Badge>
                  ) : r.isVerified ? (
                    <Badge variant="green"><ShieldCheck className="h-3 w-3" /> Verified</Badge>
                  ) : (
                    <Badge variant="amber">Pending</Badge>
                  )}
                </div>

                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-400">
                  {r.aiSummary ?? r.transcript}
                </p>

                {/* trust score bar */}
                <div className="mt-2.5 flex items-center gap-2" aria-label={`Trust score ${r.trustScore} out of 100`}>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${r.trustScore}%`,
                        background:
                          r.trustScore >= 70 ? "#10b981" : r.trustScore >= 40 ? "#f59e0b" : "#ef4444",
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-bold tabular-nums text-slate-500">{r.trustScore}</span>
                </div>
              </button>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
