"use client";

/**
 * FEATURE 8 — AI Drone Aerial Damage Assessment.
 * Upload (or load the bundled sample) aerial photo → Gemini Vision returns
 * pixel boxes for flooded zones / trapped people / damaged structures /
 * safe landing zones → rendered as a tactical overlay.
 */
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Plane, Loader2, RotateCcw, Waves, Users, Building2, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import type { DroneFindings, DroneBox } from "@/lib/gemini";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { key: "flooded_zones" as const, label: "Flooded zones", color: "#3b82f6", icon: Waves },
  { key: "trapped_people" as const, label: "People trapped", color: "#f59e0b", icon: Users },
  { key: "damaged_structures" as const, label: "Damaged structures", color: "#ef4444", icon: Building2 },
  { key: "safe_landing_zones" as const, label: "Safe LZ", color: "#10b981", icon: CircleDot },
];

export default function DroneAnalyzer() {
  const [image, setImage] = React.useState<string | null>(null);
  const [findings, setFindings] = React.useState<DroneFindings | null>(null);
  const [loading, setLoading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const analyze = async (dataUrl: string) => {
    setLoading(true);
    setFindings(null);
    try {
      const res = await fetch("/api/ai/analyze-drone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      });
      const json = (await res.json()) as { findings?: DroneFindings; error?: string };
      if (!res.ok || !json.findings) throw new Error(json.error ?? "analysis failed");
      setFindings(json.findings);
      toast({
        title: "Aerial analysis complete",
        description: json.findings.source === "gemini" ? "Gemini 2.5 Flash Vision assessment." : "Resilient fallback assessment (add GEMINI_API_KEY for live Vision).",
        variant: "success",
      });
    } catch {
      toast({ title: "Analysis failed", variant: "danger" });
    } finally {
      setLoading(false);
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      setImage(url);
      analyze(url);
    };
    reader.readAsDataURL(file);
  };

  const loadSample = async () => {
    try {
      const res = await fetch("/demo/drone-sample.jpg");
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.readAsDataURL(blob);
      });
      setImage(dataUrl);
      analyze(dataUrl);
    } catch {
      toast({ title: "Could not load sample photo", variant: "danger" });
    }
  };

  const reset = () => {
    setImage(null);
    setFindings(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const count = (boxes: DroneBox[]) => boxes.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} aria-hidden />
        <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" /> Analyze Aerial Photo
        </Button>
        <Button variant="outline" size="sm" onClick={loadSample}>
          <Plane className="h-4 w-4" /> Load Sample Drone Photo
        </Button>
        {image && (
          <Button variant="ghost" size="sm" onClick={reset} aria-label="Reset aerial analysis">
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
        )}
        {findings && (
          <Badge variant={findings.source === "gemini" ? "default" : "slate"}>
            {findings.source === "gemini" ? "Gemini Vision" : "On-device vision"}
          </Badge>
        )}
      </div>

      {/* image + overlay */}
      {!image && !loading && (
        <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/12 text-center">
          <Plane className="h-8 w-8 text-slate-600" />
          <p className="max-w-xs text-xs text-slate-500">
            Feed a drone/aerial image. The AI maps flooded zones, trapped people, damaged structures and safe landing zones as pixel overlays.
          </p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-64 w-full" />
          <p className="flex items-center justify-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> AI scanning aerial imagery…
          </p>
        </div>
      )}

      {image && !loading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative overflow-hidden rounded-2xl border border-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="Aerial disaster assessment" className="block h-auto w-full" />
          <AnimatePresence>
            {findings &&
              CATEGORIES.flatMap((cat) =>
                findings[cat.key].map((box, i) => (
                  <motion.div
                    key={`${cat.key}-${i}`}
                    initial={{ opacity: 0, scale: 1.15 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.15 + i * 0.12, type: "spring", stiffness: 200, damping: 22 }}
                    className="absolute rounded-md"
                    style={{
                      left: `${box.x * 100}%`,
                      top: `${box.y * 100}%`,
                      width: `${box.w * 100}%`,
                      height: `${box.h * 100}%`,
                      border: `2px solid ${cat.color}`,
                      background: `${cat.color}22`,
                      boxShadow: `0 0 18px ${cat.color}66, inset 0 0 18px ${cat.color}33`,
                    }}
                  >
                    <span
                      className="absolute -top-5 left-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide"
                      style={{ background: cat.color, color: "#04070f" }}
                    >
                      {box.label}
                    </span>
                  </motion.div>
                ))
              )}
          </AnimatePresence>
          <div className="absolute bottom-2 left-2 rounded-lg bg-black/60 px-2 py-1 text-[10px] font-semibold text-slate-300 backdrop-blur-sm">
            CrisisSync Aerial Grid · {findings ? "analysis overlay active" : "awaiting AI"}
          </div>
        </motion.div>
      )}

      {/* summary */}
      {findings && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Aerial analysis summary">
            {CATEGORIES.map((cat) => (
              <div
                key={cat.key}
                className={cn("flex items-center gap-2 rounded-xl border p-2.5")}
                style={{ borderColor: `${cat.color}44`, background: `${cat.color}12` }}
              >
                <cat.icon className="h-4 w-4 shrink-0" style={{ color: cat.color }} />
                <div>
                  <p className="font-display text-lg font-bold leading-none" style={{ color: cat.color }}>
                    {count(findings[cat.key])}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{cat.label}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-xs leading-relaxed text-slate-400">
            <span className="font-bold text-slate-200">AI Summary: </span>
            {findings.summary}
          </p>
        </motion.div>
      )}
    </div>
  );
}
