"use client";

/**
 * VOLUNTEER PERSONA — Mobile PWA
 * Register once as a community helper with your resources (boat, first-aid…).
 * When a neighbor fires an SOS nearby, a ping arrives; accept it and the app
 * draws a live rescue line from you to the victim.
 */
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sailboat, HeartPulse, UtensilsCrossed, Home, Car, BellRing, Check, X as XIcon,
  MapPin, Navigation, Flag, Loader2, UserRound, ShieldCheck,
} from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import EmergencyMap from "@/components/EmergencyMap";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Switch } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { useGeoLocation } from "@/lib/useGeoLocation";
import { useOnline } from "@/components/providers";
import { enableVolunteerPush, hasPushSubscription } from "@/lib/web-push-client";
import { EMERGENCY_META, severityTone, type EmergencyType, type VolunteerResources } from "@/lib/constants";
import { cn, formatMeters, timeAgo } from "@/lib/utils";
import type { SOSReport } from "@/lib/models";
import type { MapReport, RescueLine } from "@/components/map/MapView";
import { Skeleton } from "@/components/ui/skeleton";

interface StoredVolunteer {
  id: string;
  name: string;
  resources: VolunteerResources;
}

interface Alert {
  matchId: string;
  status: "pending" | "accepted";
  createdAt: string;
  sos: SOSReport;
  distanceMeters: number | null;
}

const RESOURCE_DEFS: Array<{ key: keyof VolunteerResources; label: string; icon: React.ElementType }> = [
  { key: "boat", label: "Boat", icon: Sailboat },
  { key: "first_aid", label: "First Aid", icon: HeartPulse },
  { key: "food", label: "Food", icon: UtensilsCrossed },
  { key: "shelter", label: "Shelter", icon: Home },
  { key: "vehicle", label: "Vehicle", icon: Car },
];

const LS_KEY = "crisissync_volunteer";

export default function VolunteerPage() {
  const { pos, isFallback } = useGeoLocation();
  const { toast } = useToast();
  const { online } = useOnline();

  const [me, setMe] = React.useState<StoredVolunteer | null>(null);
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [resources, setResources] = React.useState<VolunteerResources>({
    boat: false, first_aid: true, food: false, shelter: false, vehicle: true,
  });
  const [registering, setRegistering] = React.useState(false);
  const [alerts, setAlerts] = React.useState<Alert[]>([]);
  const [loadingAlerts, setLoadingAlerts] = React.useState(true);
  const [acting, setActing] = React.useState<string | null>(null);
  const [pushEnabled, setPushEnabled] = React.useState(false);
  const [enablingPush, setEnablingPush] = React.useState(false);
  const knownMatchIds = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setMe(JSON.parse(raw) as StoredVolunteer);
    } catch { /* fresh start */ }
    hasPushSubscription().then(setPushEnabled);
  }, []);

  const enablePush = React.useCallback(async (volunteerId: string, announce = true) => {
    setEnablingPush(true);
    const result = await enableVolunteerPush(volunteerId);
    setPushEnabled(result.ok);
    setEnablingPush(false);
    if (!announce) return;
    if (result.ok) {
      toast({
        title: "Push rescue alerts enabled",
        description: "Your device can now alert you even when CrisisSync is closed.",
        variant: "success",
      });
    } else {
      const messages = {
        unsupported: "This browser does not support Web Push.",
        "not-configured": "Web Push keys are not configured on the server.",
        denied: "Notification permission was denied in browser settings.",
        failed: "Push setup failed. In-app alerts will continue working.",
      } as const;
      toast({ title: "Push alerts not enabled", description: messages[result.reason], variant: "warning" });
    }
  }, [toast]);

  React.useEffect(() => {
    if (!me || !("Notification" in window) || Notification.permission !== "granted") return;
    enablePush(me.id, false);
  }, [me, enablePush]);

  // ── registration ──────────────────────────────────────────────────────────
  const register = async () => {
    if (!name.trim() || !phone.trim()) {
      toast({ title: "Name and phone are required", variant: "warning" });
      return;
    }
    if (!pos) return;
    setRegistering(true);
    try {
      const res = await fetch("/api/volunteer/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), lat: pos.lat, lng: pos.lng, resources }),
      });
      const json = (await res.json()) as { volunteer?: { id: string }; error?: string };
      if (!res.ok || !json.volunteer) throw new Error(json.error);
      const stored: StoredVolunteer = { id: json.volunteer.id, name: name.trim(), resources };
      setMe(stored);
      try { localStorage.setItem(LS_KEY, JSON.stringify(stored)); } catch { /* ok */ }
      toast({ title: "You're on the rescue network", description: "You'll be pinged when a neighbor within 2km needs your skills.", variant: "success" });
      await enablePush(stored.id, true);
    } catch {
      toast({ title: "Registration failed", description: "Check connection and retry.", variant: "danger" });
    } finally {
      setRegistering(false);
    }
  };

  // ── FEATURE 4: poll for rescue pings (simulated push) ────────────────────
  React.useEffect(() => {
    if (!me) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/volunteer/alerts?volunteerId=${me.id}`);
        const json = (await res.json()) as { alerts?: Alert[] };
        if (cancelled || !json.alerts) return;
        const fresh = json.alerts.filter((a) => a.status === "pending" && !knownMatchIds.current.has(a.matchId));
        for (const a of fresh) {
          knownMatchIds.current.add(a.matchId);
          const meta = EMERGENCY_META[a.sos.emergencyType as EmergencyType] ?? EMERGENCY_META.other;
          toast({
            title: `Neighbor ${a.distanceMeters !== null ? formatMeters(a.distanceMeters) : "nearby"} away needs ${meta.label.toUpperCase()} help`,
            description: `Severity ${a.sos.severity}/10 · Tap accept to respond.`,
            variant: "danger",
          });
        }
        json.alerts.forEach((a) => knownMatchIds.current.add(a.matchId));
        setAlerts(json.alerts);
        setLoadingAlerts(false);
      } catch { /* keep polling */ }
    };
    poll();
    const t = window.setInterval(poll, 3000);
    return () => { cancelled = true; window.clearInterval(t); };
  }, [me, toast]);

  // ── respond to a ping ─────────────────────────────────────────────────────
  const respond = async (alert: Alert, action: "accept" | "decline" | "complete") => {
    setActing(alert.matchId);
    try {
      await fetch("/api/volunteer/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: alert.matchId, action }),
      });
      if (action === "accept") {
        setAlerts((prev) => prev.map((a) => (a.matchId === alert.matchId ? { ...a, status: "accepted" } : a)));
        toast({ title: "Mission accepted", description: "Rescue line drawn to the victim. Command Center notified.", variant: "success" });
      } else if (action === "decline") {
        setAlerts((prev) => prev.filter((a) => a.matchId !== alert.matchId));
        toast({ title: "Ping declined", description: "The next nearest volunteer stays on alert." });
      } else {
        setAlerts((prev) => prev.filter((a) => a.matchId !== alert.matchId));
        toast({ title: "Mission complete", description: "Report marked resolved. Thank you, hero.", variant: "success" });
      }
    } finally {
      setActing(null);
    }
  };

  const mission = alerts.find((a) => a.status === "accepted") ?? null;

  const mapReports: MapReport[] = alerts.map((a) => ({
    id: a.sos.id,
    lat: a.sos.latitude,
    lng: a.sos.longitude,
    type: a.sos.emergencyType,
    severity: a.sos.severity,
    verified: a.sos.isVerified,
    status: a.sos.status,
    source: a.sos.source,
    summary: a.sos.aiSummary ?? a.sos.transcript,
  }));

  const lines: RescueLine[] = mission && pos
    ? [{ from: pos, to: { lat: mission.sos.latitude, lng: mission.sos.longitude }, color: "#10b981" }]
    : [];

  // ── registration view ─────────────────────────────────────────────────────
  if (!me) {
    return (
      <div className="min-h-screen">
        <SiteHeader active="volunteer" />
        <main className="mx-auto max-w-lg px-4 pb-16 pt-8">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <CardTitle className="text-xl">Become a Community Rescuer</CardTitle>
                <CardDescription>
                  When someone within 2km fires an SOS and needs what you have, your phone lights up. You are the first responder before the first responders.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div>
                  <Label htmlFor="v-name">Your name</Label>
                  <Input id="v-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ravi Kumar" autoComplete="name" />
                </div>
                <div>
                  <Label htmlFor="v-phone">Phone (emergency contact reference)</Label>
                  <Input id="v-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98XXX XXXXX" autoComplete="tel" />
                </div>
                <div>
                  <Label>Resources you can offer</Label>
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    {RESOURCE_DEFS.map((r) => (
                      <div key={r.key} className={cn("flex items-center justify-between rounded-xl border px-3.5 py-2.5 transition-colors", resources[r.key] ? "border-emerald-500/40 bg-emerald-500/[0.08]" : "border-white/[0.08] bg-white/[0.03]")}>
                        <span className="flex items-center gap-2.5 text-sm font-semibold text-slate-200">
                          <r.icon className={cn("h-4 w-4", resources[r.key] ? "text-emerald-400" : "text-slate-500")} />
                          {r.label}
                        </span>
                        <Switch checked={resources[r.key]} onCheckedChange={(v) => setResources((prev) => ({ ...prev, [r.key]: v }))} aria-label={`I can offer ${r.label}`} />
                      </div>
                    ))}
                  </div>
                </div>
                <p className="flex items-center gap-2 text-xs text-slate-500">
                  <MapPin className={cn("h-3.5 w-3.5", pos ? "text-emerald-400" : "animate-pulse text-amber-400")} />
                  {pos ? `Home base locked: ${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}${isFallback ? " (demo GPS)" : ""}` : "Locking your location…"}
                </p>
                <Button variant="success" size="lg" onClick={register} disabled={registering || !pos} className="w-full">
                  {registering ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserRound className="h-5 w-5" />}
                  Join Rescue Network
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </main>
      </div>
    );
  }

  // ── active volunteer dashboard ────────────────────────────────────────────
  return (
    <div className="min-h-screen">
      <SiteHeader
        active="volunteer"
        right={
          <>
            {!pushEnabled && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => enablePush(me.id)}
                disabled={enablingPush}
                className="hidden sm:inline-flex"
              >
                <BellRing className={cn("h-3.5 w-3.5", enablingPush && "animate-pulse")} />
                Enable push
              </Button>
            )}
            <Badge variant={online ? "green" : "amber"}>
              {pushEnabled ? "Push alerts on" : online ? "In-app alerts on" : "Offline"}
            </Badge>
          </>
        }
      />
      <main className="mx-auto flex max-w-lg flex-col gap-4 px-4 pb-16 pt-5">
        {/* mission first, if any */}
        <AnimatePresence>
          {mission && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Card className="border-emerald-500/40 bg-emerald-500/[0.06]">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-emerald-300"><Navigation className="h-4 w-4" /> Active Mission</CardTitle>
                    <Badge variant="green">En route</Badge>
                  </div>
                  <CardDescription>{mission.sos.aiSummary ?? mission.sos.transcript}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Victim {mission.distanceMeters !== null ? formatMeters(mission.distanceMeters) : "—"} away</span>
                    <a
                      className="font-bold text-emerald-300 underline underline-offset-2"
                      href={`https://www.google.com/maps/dir/?api=1&destination=${mission.sos.latitude},${mission.sos.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Navigate with GPS
                    </a>
                  </div>
                  <Button variant="success" onClick={() => respond(mission, "complete")} disabled={acting === mission.matchId}>
                    <Flag className="h-4 w-4" /> Mark Rescue Complete
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* map */}
        <div className="h-64 w-full">
          {pos ? (
            <EmergencyMap
              center={pos}
              userPos={pos}
              zoom={14}
              followUser
              reports={mapReports}
              lines={lines}
              selectedId={mission?.sos.id ?? null}
            />
          ) : (
            <Skeleton className="h-full w-full" />
          )}
        </div>

        {/* alerts */}
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-base font-bold">
            <BellRing className="h-4 w-4 text-red-400" /> Rescue pings
            {alerts.filter((a) => a.status === "pending").length > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-black text-white">
                {alerts.filter((a) => a.status === "pending").length}
              </span>
            )}
          </h2>
          <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Live · 3s sync
          </p>
        </div>

        {loadingAlerts ? (
          <div className="flex flex-col gap-2">{[0, 1].map((i) => <Skeleton key={i} className="h-28" />)}</div>
        ) : alerts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
            <BellRing className="mx-auto h-8 w-8 text-slate-700" />
            <p className="mt-3 text-sm font-semibold text-slate-400">No pings right now</p>
            <p className="mt-1 text-xs text-slate-600">When a neighbor within 2km fires an SOS matching your resources, it appears here instantly.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            <AnimatePresence initial={false}>
              {alerts.map((a) => {
                const meta = EMERGENCY_META[a.sos.emergencyType as EmergencyType] ?? EMERGENCY_META.other;
                const tone = severityTone(a.sos.severity);
                return (
                  <motion.li
                    key={a.matchId}
                    layout
                    initial={{ opacity: 0, scale: 0.96, y: -8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, x: 40 }}
                    transition={{ type: "spring", stiffness: 350, damping: 28 }}
                  >
                    <Card className={cn(a.status === "accepted" ? "border-emerald-500/40" : "border-red-500/30")}>
                      <CardContent className="flex flex-col gap-3 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-slate-100">
                              Neighbor {a.distanceMeters !== null ? formatMeters(a.distanceMeters) : ""} away needs{" "}
                              <span style={{ color: meta.color }}>{meta.label.toUpperCase()}</span> help
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-500">{timeAgo(a.sos.createdAt)} · <span className={tone.cls.split(" ")[0]}>Severity {a.sos.severity}/10</span></p>
                          </div>
                          {a.sos.isVerified && <Badge variant="green"><ShieldCheck className="h-3 w-3" /> AI verified</Badge>}
                        </div>
                        <p className="line-clamp-2 text-xs text-slate-400">{a.sos.aiSummary ?? a.sos.transcript}</p>
                        {a.status === "pending" && (
                          <div className="flex gap-2">
                            <Button variant="success" size="sm" className="flex-1" onClick={() => respond(a, "accept")} disabled={acting === a.matchId}>
                              {acting === a.matchId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Accept — I&apos;m going
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => respond(a, "decline")} disabled={acting === a.matchId} aria-label="Decline ping">
                              <XIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}

        <p className="text-center text-[11px] text-slate-600">
          Registered as <span className="font-bold text-slate-400">{me.name}</span> ·{" "}
          {Object.entries(me.resources).filter(([, v]) => v).map(([k]) => k.replace("_", " ")).join(" · ") || "no resources selected"}
        </p>
      </main>
    </div>
  );
}
