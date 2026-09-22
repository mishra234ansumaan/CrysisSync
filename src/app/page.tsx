"use client";

/**
 * CrisisSync landing — role selector + live network telemetry.
 */
import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity, Radio, HeartHandshake, LayoutDashboard, ArrowRight,
  ShieldCheck, Mic, SignalZero, Map, QrCode, Plane, BatteryWarning, Users, BrainCircuit, Route,
} from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import { Badge } from "@/components/ui/badge";
import type { StatsShape } from "@/components/StatsCards";
import { cn } from "@/lib/utils";

const ROLES = [
  {
    id: "victim",
    href: "/victim",
    icon: Radio,
    color: "#ef4444",
    title: "I need help",
    tag: "VICTIM PWA",
    desc: "One button. Your voice. AI triages, verifies and dispatches help — even with no internet, even at 5% battery.",
    cta: "Open SOS console",
  },
  {
    id: "volunteer",
    href: "/volunteer",
    icon: HeartHandshake,
    color: "#10b981",
    title: "I can help",
    tag: "VOLUNTEER PWA",
    desc: "Register your boat, first-aid kit or shelter. Get pinged the moment a neighbor within 2km needs exactly that.",
    cta: "Join rescue network",
  },
  {
    id: "admin",
    href: "/admin",
    icon: LayoutDashboard,
    color: "#38bdf8",
    title: "I command response",
    tag: "COMMAND CENTER",
    desc: "Live tactical map, AI fake-report filtering, crowd danger zones, drone damage intel and one-click dispatch.",
    cta: "Enter dashboard",
  },
] as const;

const FEATURES = [
  { icon: Mic, label: "Voice SOS triage" },
  { icon: SignalZero, label: "Offline SMS fallback" },
  { icon: BrainCircuit, label: "3-layer AI fake detection" },
  { icon: Users, label: "Peer micro-rescue" },
  { icon: Map, label: "Crowd danger zones" },
  { icon: Route, label: "Dynamic safe routing" },
  { icon: BatteryWarning, label: "Battery-death beacon" },
  { icon: Plane, label: "Drone damage AI" },
  { icon: QrCode, label: "Offline QR medical pass" },
  { icon: ShieldCheck, label: "Command dashboard" },
];

function RadarVisual() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[440px]" aria-hidden>
      {/* rings */}
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="absolute rounded-full border border-cyan-400/15"
          style={{ inset: `${i * 13}%` }}
        />
      ))}
      {/* crosshair */}
      <div className="absolute left-1/2 top-0 h-full w-px bg-cyan-400/10" />
      <div className="absolute left-0 top-1/2 h-px w-full bg-cyan-400/10" />
      {/* sweep */}
      <div
        className="radar-sweep absolute inset-0 rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, rgba(56,189,248,.45), rgba(56,189,248,.06) 60deg, transparent 90deg)",
        }}
      />
      {/* blips */}
      {[
        { top: "22%", left: "62%", c: "#ef4444", d: "0s" },
        { top: "58%", left: "30%", c: "#f59e0b", d: "0.4s" },
        { top: "70%", left: "68%", c: "#10b981", d: "0.8s" },
        { top: "34%", left: "38%", c: "#3b82f6", d: "1.2s" },
      ].map((b, i) => (
        <span key={i} className="absolute" style={{ top: b.top, left: b.left }}>
          <span className="marker-ping absolute -inset-1.5" style={{ background: b.c, animationDelay: b.d }} />
          <span className="relative block h-2.5 w-2.5 rounded-full border border-white/70" style={{ background: b.c, boxShadow: `0 0 12px ${b.c}` }} />
        </span>
      ))}
      {/* center */}
      <div className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border border-red-500/40 bg-[#0a1128] shadow-[0_0_50px_rgba(239,68,68,.45)]">
        <Activity className="h-6 w-6 text-red-400" strokeWidth={3} />
      </div>
      {/* floating chips */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.6 }}
        className="absolute -right-2 top-8 rounded-xl border border-white/10 bg-[#0e1730]/90 px-3 py-2 shadow-xl backdrop-blur"
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Trust engine</p>
        <p className="font-display text-lg font-bold text-emerald-400">3-layer AI</p>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.4, duration: 0.6 }}
        className="absolute -left-2 bottom-10 rounded-xl border border-white/10 bg-[#0e1730]/90 px-3 py-2 shadow-xl backdrop-blur"
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Offline ready</p>
        <p className="font-display text-lg font-bold text-amber-400">SMS + QR</p>
      </motion.div>
    </div>
  );
}

export default function LandingPage() {
  const [stats, setStats] = React.useState<StatsShape | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/stats");
        const json = (await res.json()) as { stats?: StatsShape };
        if (!cancelled && json.stats) setStats(json.stats);
      } catch { /* landing still works */ }
    };
    load();
    const t = window.setInterval(load, 8000);
    return () => { cancelled = true; window.clearInterval(t); };
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* backdrop */}
      <div className="grid-overlay pointer-events-none absolute inset-0" aria-hidden />
      <div className="pointer-events-none absolute -left-40 top-0 h-[520px] w-[520px] rounded-full bg-red-500/[0.13] blur-[120px]" aria-hidden />
      <div className="pointer-events-none absolute -right-40 top-64 h-[520px] w-[520px] rounded-full bg-cyan-500/[0.10] blur-[120px]" aria-hidden />

      <SiteHeader active="home" />

      {/* ── hero ── */}
      <section className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-12 lg:grid-cols-2 lg:pt-20">
        <div>
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Badge variant="red" className="mb-5 px-3 py-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" /> Live disaster-response network
            </Badge>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08 }}
            className="font-display text-[clamp(2.6rem,7vw,4.8rem)] font-bold leading-[0.98] tracking-tight"
          >
            Every second
            <br />
            is a <span className="clip-text-gradient glow-text-red">signal.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18 }}
            className="mt-5 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg"
          >
            CrisisSync turns a victim&apos;s voice into dispatched help in seconds — AI triage,
            fake-report filtering, crowd-verified danger zones, peer rescuers and drone intel,
            all offline-capable where it matters most.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.28 }}
            className="mt-7 flex flex-wrap gap-3"
          >
            <Link
              href="/victim"
              className="group inline-flex h-13 items-center gap-2 rounded-2xl bg-gradient-to-b from-red-500 to-red-600 px-7 text-sm font-bold text-white shadow-[0_14px_44px_-8px_rgba(239,68,68,.7)] transition-all hover:from-red-400 hover:to-red-500 active:scale-95"
            >
              Trigger SOS console
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/admin"
              className="inline-flex h-13 items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-7 text-sm font-bold text-slate-200 transition-all hover:border-white/30 hover:bg-white/[0.08] active:scale-95"
            >
              <LayoutDashboard className="h-4 w-4 text-cyan-300" /> Command Center
            </Link>
          </motion.div>

          {/* live telemetry */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 grid max-w-xl grid-cols-4 gap-2"
            aria-label="Live network stats"
          >
            {[
              { v: stats?.totalActive, l: "Active SOS", c: "#ef4444" },
              { v: stats?.verified, l: "AI verified", c: "#10b981" },
              { v: stats?.fakeBlocked, l: "Fakes blocked", c: "#f59e0b" },
              { v: stats?.totalVolunteers, l: "Volunteers", c: "#38bdf8" },
            ].map((s) => (
              <div key={s.l} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-center">
                <p className="font-display text-xl font-bold tabular-nums" style={{ color: s.c }}>
                  {s.v ?? "—"}
                </p>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">{s.l}</p>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.2 }}>
          <RadarVisual />
        </motion.div>
      </section>

      {/* ── role selector ── */}
      <section className="relative mx-auto max-w-7xl px-4 pb-20" aria-label="Choose your role">
        <div className="grid gap-4 md:grid-cols-3">
          {ROLES.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.55, delay: i * 0.1 }}
            >
              <Link
                href={r.href}
                className={cn(
                  "group relative block h-full overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0e1730]/70 p-6 backdrop-blur transition-all duration-300",
                  "hover:-translate-y-1.5 hover:border-white/20"
                )}
                style={{ ["--role" as string]: r.color }}
              >
                <div
                  className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full opacity-25 blur-3xl transition-opacity duration-300 group-hover:opacity-50"
                  style={{ background: r.color }}
                  aria-hidden
                />
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: `${r.color}1c`, color: r.color }}>
                    <r.icon className="h-6 w-6" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{r.tag}</span>
                </div>
                <h2 className="mt-5 font-display text-2xl font-bold tracking-tight">{r.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{r.desc}</p>
                <p className="mt-5 flex items-center gap-1.5 text-sm font-bold" style={{ color: r.color }}>
                  {r.cta}
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1.5" />
                </p>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── feature marquee ── */}
      <section className="relative border-y border-white/[0.06] bg-[#04070f]/60 py-6" aria-label="Platform capabilities">
        <div className="overflow-hidden">
          <div className="animate-marquee flex w-max gap-3 pr-3">
            {[...FEATURES, ...FEATURES].map((f, i) => (
              <span key={i} className="flex items-center gap-2 whitespace-nowrap rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs font-bold text-slate-300">
                <f.icon className="h-3.5 w-3.5 text-red-400" /> {f.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col items-center gap-2 px-4 py-10 text-center">
        <p className="flex items-center gap-2 font-display text-sm font-bold">
          <Activity className="h-4 w-4 text-red-400" /> CrisisSync — AI Emergency Preparedness &amp; Response
        </p>
        <p className="text-xs text-slate-600">
          Voice · Vision · Verification · Volunteers. Powered by Supabase, Vercel Functions, Web Push &amp; OpenStreetMap.
        </p>
      </footer>
    </div>
  );
}
