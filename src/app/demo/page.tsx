"use client";

/**
 * DEMO MODE — hidden judge control panel.
 * One-click scenario triggers that drive every persona in the system live.
 */
import * as React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Waves, Mic, BatteryWarning, ImageOff, Plane, DatabaseZap, Trash2, ArrowRight,
  SignalZero, ClipboardList, Loader2, FlaskConical,
} from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import DroneAnalyzer from "@/components/DroneAnalyzer";
import SosResultCard, { type SosResult } from "@/components/SosResultCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface LogEntry {
  at: string;
  label: string;
  detail: string;
  tone: "ok" | "warn" | "info";
}

export default function DemoPage() {
  const { toast } = useToast();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [log, setLog] = React.useState<LogEntry[]>([]);
  const [lastResult, setLastResult] = React.useState<SosResult & { report?: { emergencyType?: string } } | null>(null);
  const [seedState, setSeedState] = React.useState<string | null>(null);

  const pushLog = (label: string, detail: string, tone: LogEntry["tone"] = "info") =>
    setLog((prev) => [{ at: new Date().toLocaleTimeString(), label, detail, tone }, ...prev].slice(0, 12));

  const simulate = async (action: string, label: string, tone: LogEntry["tone"] = "info") => {
    setBusy(action);
    try {
      const res = await fetch("/api/demo/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = (await res.json()) as Record<string, unknown> & SosResult;
      if (!res.ok) throw new Error(String(json.error ?? "failed"));
      if (json.triage && json.verification) setLastResult(json);
      const detail =
        action === "flood-cluster"
          ? `${json.created} reports in, ${json.verified} crowd-verified — red zone live on Command map.`
          : action === "fake-report"
            ? `Trust score ${json.verification?.trustScore}% — AI verdict: ${json.verification?.isFake ? "FAKE, quarantined" : "passed"}.`
            : action === "battery-beacon"
              ? "LAST_GASP_BEACON pinned on the Command map (amber diamond marker)."
              : json.verification
                ? `Trust ${json.verification.trustScore}% · ${json.matched?.length ?? 0} volunteers pinged.`
                : String(json.message ?? "done");
      pushLog(label, detail, tone);
      toast({ title: label, description: detail, variant: tone === "warn" ? "warning" : "success" });
    } catch (e) {
      pushLog(label, "Failed — check server logs", "warn");
      toast({ title: "Simulation failed", variant: "danger" });
    } finally {
      setBusy(null);
    }
  };

  const seed = async (force: boolean) => {
    setBusy("seed");
    try {
      const res = await fetch("/api/demo/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const json = (await res.json()) as { message?: string; reports?: number };
      const msg = json.message ?? `Seeded ${json.reports} SOS reports + 8 volunteers around Hyderabad.`;
      setSeedState(msg);
      pushLog("Demo data seeded", msg, "ok");
      toast({ title: "Seed complete", description: msg, variant: "success" });
    } catch {
      toast({ title: "Seed failed", variant: "danger" });
    } finally {
      setBusy(null);
    }
  };

  const SCENARIOS = [
    {
      id: "flood-cluster",
      icon: Waves,
      color: "#3b82f6",
      title: "Simulate Flood Cluster",
      desc: "Drops 5 simultaneous flood SOS in one block — watch crowd clustering auto-verify and paint a red danger zone.",
      run: () => simulate("flood-cluster", "Flood cluster simulated"),
    },
    {
      id: "voice-sos",
      icon: Mic,
      color: "#ef4444",
      title: "Trigger Voice SOS",
      desc: "Fires a predefined fire-building voice report through the full Gemini triage + matching pipeline.",
      run: () => simulate("voice-sos", "Voice SOS triaged"),
    },
    {
      id: "battery",
      icon: BatteryWarning,
      color: "#f59e0b",
      title: "Simulate 5% Battery",
      desc: "Opens the Victim PWA at 5% battery — beacon fires automatically and the UI drops to grayscale.",
      run: () => window.open("/victim?battery=5", "_blank"),
      secondary: { label: "Fire beacon on map", run: () => simulate("battery-beacon", "Battery beacon fired", "warn") },
    },
    {
      id: "fake",
      icon: ImageOff,
      color: "#a855f7",
      title: "Test Fake Report",
      desc: "Uploads a cat photo claiming a building fire. The 3-layer AI engine catches it and quarantines the report.",
      run: () => simulate("fake-report", "Fake report tested", "warn"),
    },
    {
      id: "offline",
      icon: SignalZero,
      color: "#f59e0b",
      title: "Simulate Offline SMS",
      desc: "Opens the Victim PWA in offline mode — SOS becomes an SMS micro-code instead of a network call.",
      run: () => window.open("/victim?offline=1", "_blank"),
    },
    {
      id: "drone-link",
      icon: Plane,
      color: "#10b981",
      title: "Drone Aerial Analysis",
      desc: "Sample aerial photo is bundled below — run the AI assessment and inspect the pixel-coordinate overlay.",
      run: () => document.getElementById("drone-panel")?.scrollIntoView({ behavior: "smooth" }),
    },
  ];

  return (
    <div className="min-h-screen">
      <SiteHeader active="demo" right={<Badge variant="purple"><FlaskConical className="h-3 w-3" /> Judge mode</Badge>} />
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-8">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Demo Control Room</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Every button drives the real system end-to-end: database, AI pipeline, volunteer pings and the Command Center map.
          </p>
        </motion.div>

        {/* seed bar */}
        <Card className="mt-6 border-cyan-400/20">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-bold text-slate-100">Step 0 — Seed the stage</p>
              <p className="text-xs text-slate-500">{seedState ?? "20 realistic SOS reports + 8 volunteers around Hyderabad (already seeded on first boot)."}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => seed(true)} disabled={busy === "seed"}>
                {busy === "seed" ? <Loader2 className="h-4 w-4 animate-spin" /> : <DatabaseZap className="h-4 w-4" />} Re-seed fresh
              </Button>
              <Button variant="danger" size="sm" onClick={() => simulate("clear", "Stage cleared", "warn")} disabled={busy === "clear"}>
                <Trash2 className="h-4 w-4" /> Clear SOS data
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* scenarios */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SCENARIOS.map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.06 }}>
              <Card className="h-full transition-all duration-200 hover:border-white/20 hover:bg-[#111c3d]/80">
                <CardHeader className="pb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${s.color}1f`, color: s.color }}>
                    <s.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="mt-2 text-base">{s.title}</CardTitle>
                  <CardDescription className="text-xs leading-relaxed">{s.desc}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <Button size="sm" onClick={s.run} disabled={busy === s.id} style={{ background: `${s.color}22`, color: s.color, border: `1px solid ${s.color}44` } as React.CSSProperties}>
                    {busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <s.icon className="h-4 w-4" />} Run
                  </Button>
                  {s.secondary && (
                    <Button size="sm" variant="ghost" onClick={s.secondary.run} disabled={busy === "battery-beacon"}>
                      {busy === "battery-beacon" && <Loader2 className="h-4 w-4 animate-spin" />} {s.secondary.label}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* live result + log */}
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div>
            {lastResult ? (
              <div className="flex flex-col gap-3">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Latest pipeline output</p>
                <SosResultCard result={lastResult} />
              </div>
            ) : (
              <Card className="flex h-full min-h-40 items-center justify-center border-dashed">
                <p className="p-6 text-center text-sm text-slate-500">Run a scenario — the AI pipeline output renders here.</p>
              </Card>
            )}
          </div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm"><ClipboardList className="h-4 w-4 text-cyan-300" /> Activity log</CardTitle>
            </CardHeader>
            <CardContent>
              {log.length === 0 ? (
                <p className="text-xs text-slate-600">No actions yet this session.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {log.map((l, i) => (
                    <li key={i} className="rounded-xl bg-white/[0.03] p-2.5 text-xs">
                      <span className={cn("font-bold", l.tone === "ok" ? "text-emerald-300" : l.tone === "warn" ? "text-amber-300" : "text-cyan-300")}>
                        [{l.at}] {l.label}
                      </span>
                      <span className="mt-0.5 block text-slate-400">{l.detail}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* drone panel */}
        <Card id="drone-panel" className="mt-6 scroll-mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Plane className="h-4 w-4 text-emerald-400" /> AI Drone Aerial Damage Assessment</CardTitle>
            <CardDescription>Same analyzer lives in the Command Center sidebar → Drone AI tab.</CardDescription>
          </CardHeader>
          <CardContent>
            <DroneAnalyzer />
          </CardContent>
        </Card>

        {/* judge script */}
        <Card className="mt-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Suggested 3-minute stage path</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
              {[
                <>Seed, then open <Link className="font-bold text-cyan-300" href="/admin">Command Center</Link> — map, clusters, stats are live.</>,
                <>Open <Link className="font-bold text-cyan-300" href="/victim">Victim PWA</Link> on a phone, hold the red button, speak: &ldquo;Fire in my building!&rdquo; — AI triage + volunteer ping.</>,
                <>Register on <Link className="font-bold text-cyan-300" href="/volunteer">Volunteer</Link> with a boat (Hyderabad = flood demo), then run &ldquo;Simulate Flood Cluster&rdquo; — accept the ping, watch the rescue line.</>,
                <>Run &ldquo;Test Fake Report&rdquo; — reload Command Center: the cat-photo &ldquo;fire&rdquo; sits quarantined with 5% trust.</>,
                <>Show Evacuate on the Victim app — the green route detours around the red zone you created.</>,
                <>Finish with the Drone AI overlay, then QR Medical Pass — 100% offline.</>,
              ].map((step, i) => (
                <li key={i} className="flex gap-2.5 rounded-xl bg-white/[0.03] p-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-[10px] font-black text-cyan-300">{i + 1}</span>
                  <span className="leading-relaxed">{step}</span>
                  <ArrowRight className="ml-auto hidden h-3.5 w-3.5 shrink-0 self-center text-slate-600 sm:block" />
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
