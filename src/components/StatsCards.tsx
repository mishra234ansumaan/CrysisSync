"use client";

/**
 * Command Center KPI cards (Feature 10).
 */
import { motion } from "framer-motion";
import { Siren, ShieldCheck, ShieldX, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export interface StatsShape {
  totalActive: number;
  verified: number;
  fakeBlocked: number;
  volunteersDeployed: number;
  totalVolunteers: number;
  resolved: number;
}

const CARDS = [
  { key: "totalActive", label: "Active SOS", icon: Siren, color: "#ef4444", sub: "live incoming" },
  { key: "verified", label: "AI Verified", icon: ShieldCheck, color: "#10b981", sub: "trust ≥ 70" },
  { key: "fakeBlocked", label: "Fakes Blocked", icon: ShieldX, color: "#f59e0b", sub: "3-layer engine" },
  { key: "volunteersDeployed", label: "Volunteers Out", icon: Users, color: "#38bdf8", sub: "accepted missions" },
] as const;

export default function StatsCards({ stats, loading }: { stats?: StatsShape | null; loading?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Key statistics">
      {CARDS.map((c, i) => (
        <motion.div
          key={c.key}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07, type: "spring", stiffness: 260, damping: 26 }}
          className="rounded-2xl border border-white/[0.07] bg-[#0e1730]/80 p-4 backdrop-blur-sm"
        >
          {loading || !stats ? (
            <>
              <Skeleton className="h-4 w-20" />
              <Skeleton className="mt-3 h-8 w-14" />
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{c.label}</p>
                <c.icon className="h-4 w-4" style={{ color: c.color }} />
              </div>
              <p className="mt-1.5 font-display text-3xl font-bold tabular-nums" style={{ color: c.color }}>
                {stats[c.key]}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-600">{c.sub}</p>
            </>
          )}
        </motion.div>
      ))}
    </div>
  );
}
