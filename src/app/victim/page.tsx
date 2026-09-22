"use client";

/**
 * VICTIM PERSONA — Mobile PWA (/)
 * Zero-friction panic UI: one giant voice button, offline SMS fallback,
 * battery-death beacon, one-tap evacuate routing and the offline QR pass.
 */
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, X, MapPin, Navigation, Waves, Flame, HeartPulse, Activity, BatteryWarning,
  Copy, MessageSquare, CheckCheck, SignalZero, FlaskConical, Loader2,
} from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import VoiceButton from "@/components/VoiceButton";
import BatteryMonitor from "@/components/BatteryMonitor";
import OfflineBanner from "@/components/OfflineBanner";
import SosResultCard, { type SosResult } from "@/components/SosResultCard";
import QRMedicalPass from "@/components/QRMedicalPass";
import SafeRoutePlanner from "@/components/SafeRoutePlanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/form";
import { Switch } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { useOnline, useBattery } from "@/components/providers";
import { useGeoLocation } from "@/lib/useGeoLocation";
import { cuidOrStable } from "@/lib/client-helpers";
import { cn } from "@/lib/utils";
import { compressEvidenceImage } from "@/lib/image-compression";

const QUICK_SOS = [
  { type: "flood", icon: Waves, label: "Flood", color: "#3b82f6" },
  { type: "fire", icon: Flame, label: "Fire", color: "#f97316" },
  { type: "medical", icon: HeartPulse, label: "Medical", color: "#ef4444" },
  { type: "earthquake", icon: Activity, label: "Quake", color: "#a855f7" },
] as const;

function guessType(t: string): string {
  if (/flood|water|drown|बाढ़|पानी/i.test(t)) return "flood";
  if (/fire|smoke|burn|आग|धुआं/i.test(t)) return "fire";
  if (/heart|bleed|injur|unconscious|accident|चोट|खून|बेहोश/i.test(t)) return "medical";
  if (/quake|tremor|भूकंप/i.test(t)) return "earthquake";
  return "other";
}

export default function VictimPage() {
  const { pos, isFallback } = useGeoLocation();
  const { online, simulatedOffline, setSimulatedOffline } = useOnline();
  const battery = useBattery();
  const { toast } = useToast();

  const [lang, setLang] = React.useState<"en-IN" | "hi-IN">("en-IN");
  const [interim, setInterim] = React.useState("");
  const [listening, setListening] = React.useState(false);
  const [manualMode, setManualMode] = React.useState(false);
  const [manualText, setManualText] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [result, setResult] = React.useState<SosResult | null>(null);
  const [offlineSos, setOfflineSos] = React.useState<string | null>(null);
  const [offlineSent, setOfflineSent] = React.useState(false);
  const [imageData, setImageData] = React.useState<{ dataUrl: string; name: string } | null>(null);
  const [beaconSent, setBeaconSent] = React.useState(false);
  const [grayscale, setGrayscale] = React.useState(false);

  const fileRef = React.useRef<HTMLInputElement>(null);
  const beaconLock = React.useRef(false);

  // ── demo deep links (?battery=5&offline=1) from the /demo control panel ──
  React.useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("battery") === "5") battery.simulateLevel(0.05);
    if (q.get("offline") === "1") setSimulatedOffline(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── FEATURE 7: battery-death beacon ──────────────────────────────────────
  const onBatteryCritical = React.useCallback(
    (critical: boolean) => {
      if (!critical) {
        setGrayscale(false);
        return;
      }
      setGrayscale(true);
      if (beaconLock.current || !pos) return;
      beaconLock.current = true;
      (async () => {
        try {
          await fetch("/api/sos/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              transcript: "LAST_GASP_BEACON — battery at 5%. Auto-distress with last known GPS location.",
              lat: pos.lat,
              lng: pos.lng,
              userId: cuidOrStable(),
              source: "beacon",
            }),
          });
        } catch { /* beacon failure is silent — UI already in beacon mode */ }
        setBeaconSent(true);
        toast({
          title: "Emergency Beacon Activated",
          description: "Your location has been shared with rescuers. Power-saving mode on.",
          variant: "warning",
        });
      })();
    },
    [pos, toast]
  );

  // ── core SOS sender (online) ─────────────────────────────────────────────
  const sendSos = async (transcript: string, source: "voice" | "manual" | "demo" = "voice") => {
    if (!pos) {
      toast({ title: "Locating you…", description: "GPS lock pending — try again in a moment.", variant: "warning" });
      return;
    }
    if (!online) {
      const code = `SOS#${pos.lat.toFixed(4)}#${pos.lng.toFixed(4)}#${guessType(transcript)}#8`;
      setOfflineSos(code);
      setOfflineSent(false);
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/sos/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          lat: pos.lat,
          lng: pos.lng,
          userId: cuidOrStable(),
          source,
          imageDataUrl: imageData?.dataUrl,
          imageFileName: imageData?.name,
        }),
      });
      const json = (await res.json()) as SosResult & { error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? "failed");
      setResult(json);
      setImageData(null);
      if (json.verification.isFake) {
        toast({ title: "Report flagged by AI verification", description: "Our 3-layer engine marked this report as low-trust.", variant: "warning" });
      } else if (json.matched.length > 0) {
        const pushDeliveries = json.notifications?.filter(
          (notification) => notification.delivered && notification.provider === "web-push"
        ).length ?? 0;
        toast({
          title: `${json.matched.length} nearby volunteer${json.matched.length > 1 ? "s" : ""} pinged`,
          description:
            pushDeliveries > 0
              ? `${pushDeliveries} free Web Push alert${pushDeliveries === 1 ? "" : "s"} delivered · in-app alerts saved.`
              : "Persistent in-app rescue alerts created · Command Center is tracking your SOS live.",
          variant: "success",
        });
      } else {
        toast({ title: "SOS live on the network", description: "Command Center is tracking your report.", variant: "success" });
      }
    } catch {
      toast({ title: "Network error", description: "Falling back to SMS micro-code mode.", variant: "danger" });
      const code = `SOS#${pos.lat.toFixed(4)}#${pos.lng.toFixed(4)}#${guessType(transcript)}#8`;
      setOfflineSos(code);
    } finally {
      setSending(false);
      setInterim("");
    }
  };

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressEvidenceImage(file);
      setImageData(compressed);
      toast({
        title: "Evidence photo attached",
        description: "Optimized for storage · AI Vision will verify it with your SOS.",
      });
    } catch {
      toast({ title: "Could not process this image", variant: "danger" });
    }
  };

  const copyCode = async () => {
    if (!offlineSos) return;
    try {
      await navigator.clipboard.writeText(offlineSos);
      setOfflineSent(true);
      toast({ title: "Micro-code copied", variant: "success" });
    } catch {
      toast({ title: "Copy manually", description: offlineSos });
    }
  };

  return (
    <div className={cn("min-h-screen", grayscale && "emergency-grayscale")}>
      <SiteHeader
        active="victim"
        right={
          <>
            <BatteryMonitor onCriticalChange={onBatteryCritical} />
            <Badge variant={online ? "green" : "amber"} className="hidden sm:inline-flex">
              {online ? "Online" : "Offline"}
            </Badge>
          </>
        }
      />
      <OfflineBanner />

      {/* beacon banner */}
      <AnimatePresence>
        {beaconSent && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="overflow-hidden border-b border-red-500/40 bg-red-500/15"
            role="alert"
          >
            <div className="mx-auto flex max-w-lg items-center gap-2.5 px-4 py-2.5">
              <BatteryWarning className="h-4 w-4 shrink-0 animate-pulse text-red-300" />
              <p className="text-xs font-bold text-red-200">
                Emergency Beacon Activated — Your location has been shared
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="mx-auto flex max-w-lg flex-col gap-6 px-4 pb-20 pt-6">
        {/* GPS status */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-2.5">
          <p className="flex items-center gap-2 text-xs text-slate-400">
            <MapPin className={cn("h-3.5 w-3.5", pos ? "text-emerald-400" : "animate-pulse text-amber-400")} />
            {pos ? `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}` : "Acquiring GPS lock…"}
          </p>
          {isFallback && <Badge variant="slate">demo GPS</Badge>}
        </motion.div>

        {/* ── FEATURE 1: voice triage ── */}
        <section aria-label="Emergency voice SOS" className="flex flex-col items-center gap-5">
          {/* language auto-detect toggle */}
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1" role="tablist" aria-label="Voice language">
            {(["en-IN", "hi-IN"] as const).map((l) => (
              <button
                key={l}
                role="tab"
                aria-selected={lang === l}
                onClick={() => setLang(l)}
                className={cn(
                  "cursor-pointer rounded-full px-4 py-1.5 text-xs font-bold transition-all",
                  lang === l ? "bg-red-500/20 text-red-300 shadow-[inset_0_0_0_1px_rgba(239,68,68,.35)]" : "text-slate-500 hover:text-slate-300"
                )}
              >
                {l === "en-IN" ? "English" : "हिंदी"}
              </button>
            ))}
          </div>

          <VoiceButton
            lang={lang}
            disabled={sending}
            onListeningChange={setListening}
            onInterim={setInterim}
            onTranscript={(t) => sendSos(t)}
            onFallbackToText={() => setManualMode(true)}
          />

          {/* live transcript */}
          <AnimatePresence>
            {(listening || interim) && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="w-full rounded-2xl border border-red-500/25 bg-red-500/[0.06] p-3.5"
                aria-live="polite"
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-red-400/80">Live transcription</p>
                <p className="mt-1 min-h-5 text-sm text-slate-200">{interim || "Speak now…"}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {sending && (
            <div className="flex items-center gap-2 text-sm text-slate-400" role="status">
              <Loader2 className="h-4 w-4 animate-spin text-red-400" /> AI triage in progress…
            </div>
          )}

          {/* manual entry */}
          <AnimatePresence>
            {manualMode && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="w-full overflow-hidden">
                <Textarea
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder="Type your emergency — what happened, how many people, dangers…"
                  aria-label="Type your emergency message"
                />
                <Button className="mt-2 w-full" disabled={manualText.trim().length < 4 || sending} onClick={() => { sendSos(manualText.trim(), "manual"); setManualText(""); }}>
                  Send typed SOS
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* quick SOS */}
          <div className="w-full">
            <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">Or tap instant SOS</p>
            <div className="grid grid-cols-4 gap-2">
              {QUICK_SOS.map((q) => (
                <button
                  key={q.type}
                  onClick={() => sendSos(`URGENT ${q.label} emergency at my location. Immediate help needed.`, "demo")}
                  disabled={sending}
                  aria-label={`Instant ${q.label} SOS`}
                  className="flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border bg-white/[0.03] py-3 transition-all hover:bg-white/[0.07] active:scale-95 disabled:opacity-40"
                  style={{ borderColor: `${q.color}30` }}
                >
                  <q.icon className="h-5 w-5" style={{ color: q.color }} />
                  <span className="text-[11px] font-bold text-slate-300">{q.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* photo evidence */}
          <div className="flex w-full items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} aria-hidden />
            <Button variant="outline" size="sm" className="flex-1" onClick={() => fileRef.current?.click()}>
              <Camera className="h-4 w-4" /> Attach photo evidence
            </Button>
            {imageData && (
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-2.5 py-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageData.dataUrl} alt="Attached evidence" className="h-7 w-7 rounded-md object-cover" />
                <button onClick={() => setImageData(null)} aria-label="Remove photo" className="cursor-pointer text-slate-500 hover:text-white">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </section>

        {/* AI result */}
        <AnimatePresence>{result && <SosResultCard result={result} />}</AnimatePresence>

        {/* ── FEATURE 6: dynamic safe routing ── */}
        <Card id="evacuate" className="scroll-mt-16 border-emerald-500/25">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Navigation className="h-4 w-4 text-emerald-400" /> Evacuate — Dynamic Safe Route
            </CardTitle>
            <CardDescription>
              Choose any destination. The route is drawn around every live red danger zone on the map.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SafeRoutePlanner origin={pos} />
          </CardContent>
        </Card>

        {/* ── FEATURE 9: QR medical pass ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><HeartPulse className="h-4 w-4 text-red-400" /> Offline QR Medical Pass</CardTitle>
            <CardDescription>Rescuers scan it with any phone camera — no internet, no app needed.</CardDescription>
          </CardHeader>
          <CardContent>
            <QRMedicalPass />
          </CardContent>
        </Card>

        {/* demo tools */}
        <Card className="border-white/[0.05]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-slate-400"><FlaskConical className="h-4 w-4" /> Demo tools</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs text-slate-400"><SignalZero className="h-3.5 w-3.5" /> Simulate Offline Mode</span>
              <Switch checked={simulatedOffline} onCheckedChange={setSimulatedOffline} aria-label="Toggle simulated offline mode" />
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs text-slate-400"><BatteryWarning className="h-3.5 w-3.5" /> Simulate 5% Battery</span>
              <Button variant="warning" size="sm" onClick={() => battery.simulateLevel(0.05)}>
                Trigger
              </Button>
            </div>
            {(battery.simulated !== null || simulatedOffline) && (
              <Button variant="ghost" size="sm" onClick={() => { battery.simulateLevel(null); setSimulatedOffline(false); beaconLock.current = false; setBeaconSent(false); setGrayscale(false); }}>
                Reset simulations
              </Button>
            )}
          </CardContent>
        </Card>
      </main>

      {/* ── FEATURE 2: offline SMS dialog ── */}
      <Dialog open={Boolean(offlineSos)} onOpenChange={(o) => !o && setOfflineSos(null)} title="Offline SOS — SMS Micro-Code" description="No internet detected. Send this code to the rescue gateway via any SMS app.">
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-4 text-center">
            <p className="font-mono text-lg font-bold tracking-wider text-amber-200" aria-label="SOS micro code">{offlineSos}</p>
          </div>
          <ol className="list-decimal space-y-1 pl-5 text-xs leading-relaxed text-slate-400">
            <li>Tap below to open your SMS app with the code pre-filled.</li>
            <li>Send it to the CrisisSync gateway number.</li>
            <li>The Command Center decodes it instantly: location, type, severity.</li>
          </ol>
          <div className="flex gap-2">
            <a href={`sms:?body=${encodeURIComponent(offlineSos ?? "")}`} className="flex-1">
              <Button variant="warning" className="w-full" onClick={() => setOfflineSent(true)}>
                <MessageSquare className="h-4 w-4" /> Open SMS App
              </Button>
            </a>
            <Button variant="secondary" onClick={copyCode} aria-label="Copy micro code">
              {offlineSent ? <CheckCheck className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />} Copy
            </Button>
          </div>
          <p className="text-center text-[10px] uppercase tracking-widest text-slate-600">
            Code format: SOS#latitude#longitude#type#severity
          </p>
        </div>
      </Dialog>

    </div>
  );
}
