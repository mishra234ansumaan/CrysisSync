"use client";

/**
 * COMMAND CENTER PERSONA — Desktop dashboard (Feature 10)
 * Real-time tactical map with crowd-clustered danger zones, a live feed with
 * AI trust scores, filters, one-click dispatch, and the drone aerial analyzer.
 */
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Radio, Filter, ShieldCheck, ShieldX, Truck, CheckCheck,
  CloudRain, Users, Image as ImageIcon, X, Sparkles, Navigation,
} from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import EmergencyMap from "@/components/EmergencyMap";
import SOSFeed from "@/components/SOSFeed";
import StatsCards, { type StatsShape } from "@/components/StatsCards";
import DroneAnalyzer from "@/components/DroneAnalyzer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, Switch, Label } from "@/components/ui/form";
import { Tabs } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { COMMAND_BASE, DEMO_CENTER, EMERGENCY_META, severityTone, type EmergencyType } from "@/lib/constants";
import type { SafeRoute, DangerZone } from "@/lib/routing";
import { cn, timeAgo } from "@/lib/utils";
import type { SOSReport } from "@/lib/models";
import type { MapReport, MapZone, MapVolunteer } from "@/components/map/MapView";
import type { VerificationReport } from "@/lib/verification";
import type { LatLng } from "@/lib/geo";

interface Filters {
  type: string;
  minSeverity: number;
  verified: "all" | "yes" | "no";
  showFakes: boolean;
  showResolved: boolean;
}

const SEV_OPTIONS = [
  { v: "0", label: "All severities" },
  { v: "5", label: "High (5+)" },
  { v: "8", label: "Critical (8+)" },
];

export default function AdminPage() {
  const { toast } = useToast();
  const [reports, setReports] = React.useState<SOSReport[]>([]);
  const [zones, setZones] = React.useState<MapZone[]>([]);
  const [volunteers, setVolunteers] = React.useState<MapVolunteer[]>([]);
  const [stats, setStats] = React.useState<StatsShape | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [focusPos, setFocusPos] = React.useState<LatLng | null>(null);
  const [tab, setTab] = React.useState("feed");
  const [dispatchRoute, setDispatchRoute] = React.useState<SafeRoute | null>(null);
  const [dispatchTarget, setDispatchTarget] = React.useState<(LatLng & { name: string }) | null>(null);
  const [routingBusy, setRoutingBusy] = React.useState(false);
  const [filters, setFilters] = React.useState<Filters>({
    type: "all", minSeverity: 0, verified: "all", showFakes: true, showResolved: false,
  });
  const lastSeenCreated = React.useRef<number>(Date.now());
  const actingRef = React.useRef(false);

  // ── polling loops ──────────────────────────────────────────────────────────
  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [sosRes, clusterRes] = await Promise.all([
          fetch("/api/sos/list?includeFake=1"),
          fetch("/api/sos/clusters"),
        ]);
        const sosJson = (await sosRes.json()) as { reports?: SOSReport[] };
        const clusterJson = (await clusterRes.json()) as { clusters?: MapZone[] };
        if (cancelled) return;
        const list = sosJson.reports ?? [];
        // alert Ops on brand-new critical reports
        const freshCritical = list.filter(
          (r) => !r.isFake && r.severity >= 8 && new Date(r.createdAt).getTime() > lastSeenCreated.current
        );
        for (const r of freshCritical) {
          toast({
            title: `CRITICAL SOS — ${(EMERGENCY_META[r.emergencyType as EmergencyType] ?? EMERGENCY_META.other).label.toUpperCase()} (SEV ${r.severity})`,
            description: (r.aiSummary ?? r.transcript).slice(0, 120),
            variant: "danger",
          });
        }
        if (list.length) lastSeenCreated.current = Math.max(...list.map((r) => new Date(r.createdAt).getTime()));
        setReports(list);
        setZones(clusterJson.clusters ?? []);
        setLoading(false);
      } catch { /* retry on next tick */ }
    };
    const statsLoad = async () => {
      try {
        const res = await fetch("/api/stats");
        const json = (await res.json()) as { stats?: StatsShape };
        if (!cancelled && json.stats) setStats(json.stats as StatsShape);
      } catch { /* noop */ }
    };
    const volLoad = async () => {
      try {
        const res = await fetch("/api/volunteer/register");
        const json = (await res.json()) as { volunteers?: { id: string; name: string; latitude: number; longitude: number }[] };
        if (!cancelled && json.volunteers) {
          setVolunteers(json.volunteers.map((v) => ({ id: v.id, name: v.name, lat: v.latitude, lng: v.longitude })));
        }
      } catch { /* noop */ }
    };
    load(); statsLoad(); volLoad();
    const t1 = window.setInterval(load, 3000);
    const t2 = window.setInterval(statsLoad, 4000);
    const t3 = window.setInterval(volLoad, 10000);
    return () => { cancelled = true; [t1, t2, t3].forEach((t) => window.clearInterval(t)); };
  }, [toast]);

  // ── filtering ──────────────────────────────────────────────────────────────
  const filtered = reports.filter((r) => {
    if (!filters.showFakes && r.isFake) return false;
    if (!filters.showResolved && r.status === "resolved") return false;
    if (filters.type !== "all" && r.emergencyType !== filters.type) return false;
    if (r.severity < filters.minSeverity) return false;
    if (filters.verified === "yes" && !r.isVerified) return false;
    if (filters.verified === "no" && r.isVerified) return false;
    return true;
  });

  const selected = selectedId ? reports.find((r) => r.id === selectedId) ?? null : null;

  const notes: VerificationReport["notes"] | null = React.useMemo(() => {
    if (!selected?.verificationNotes) return null;
    try {
      return (JSON.parse(selected.verificationNotes) as { notes?: VerificationReport["notes"] }).notes ?? JSON.parse(selected.verificationNotes);
    } catch {
      return null;
    }
  }, [selected]);

  // ── actions ─────────────────────────────────────────────────────────────────
  const act = async (id: string, action: "verify" | "fake" | "dispatch" | "resolve") => {
    if (actingRef.current) return;
    actingRef.current = true;
    try {
      await fetch("/api/sos/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const labels = {
        verify: "Report manually verified",
        fake: "Report quarantined as fake",
        dispatch: "Rescue Team Alpha dispatched to zone",
        resolve: "Incident marked resolved",
      } as const;
      toast({ title: labels[action], variant: action === "fake" ? "warning" : "success" });
      setReports((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                isVerified: action === "verify" ? true : action === "fake" ? false : r.isVerified,
                isFake: action === "fake",
                trustScore: action === "verify" ? 95 : action === "fake" ? 5 : r.trustScore,
                status: action === "dispatch" ? "dispatched" : action === "resolve" ? "resolved" : r.status,
              }
            : r
        )
      );
      if (action === "resolve" || action === "fake") setSelectedId(null);
    } finally {
      actingRef.current = false;
    }
  };

  /** Feature 6 for responders: hazard-avoiding approach route to an incident. */
  const planDispatchRoute = async (report: SOSReport) => {
    setRoutingBusy(true);
    try {
      const danger: DangerZone[] = zones
        .filter((zone) => zone.isDangerZone)
        .map((zone) => ({
          lat: zone.center.lat,
          lng: zone.center.lng,
          radiusMeters: Math.max(zone.radiusMeters, 300),
        }));
      const response = await fetch("/api/routing/safe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: { lat: COMMAND_BASE.lat, lng: COMMAND_BASE.lng },
          to: { lat: report.latitude, lng: report.longitude },
          zones: danger,
        }),
      });
      const json = (await response.json()) as { route?: SafeRoute; provider?: string };
      if (!response.ok || !json.route) throw new Error("routing failed");
      setDispatchRoute(json.route);
      setDispatchTarget({
        lat: report.latitude,
        lng: report.longitude,
        name: `Incident · ${(EMERGENCY_META[report.emergencyType as EmergencyType] ?? EMERGENCY_META.other).label}`,
      });
      toast({
        title: "Safe approach route plotted",
        description: `${(json.route.distanceMeters / 1000).toFixed(1)} km · ${Math.ceil(json.route.durationSeconds / 60)} min · avoids ${json.route.avoidedZones} danger zone(s).`,
        variant: "success",
      });
    } catch {
      toast({ title: "Could not plot approach route", variant: "danger" });
    } finally {
      setRoutingBusy(false);
    }
  };

  const mapReports: MapReport[] = filtered.map((r) => ({
    id: r.id, lat: r.latitude, lng: r.longitude, type: r.emergencyType,
    severity: r.severity, verified: r.isVerified, status: r.status,
    source: r.source, summary: r.aiSummary ?? r.transcript,
  }));

  const selectReport = (r: SOSReport) => {
    setSelectedId(r.id);
    setFocusPos({ lat: r.latitude, lng: r.longitude });
  };

  const dangerCount = zones.filter((z) => z.isDangerZone).length;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        active="admin"
        right={
          <>
            <Badge variant={dangerCount > 0 ? "red" : "green"} className="hidden sm:inline-flex">
              {dangerCount > 0 ? `${dangerCount} danger zone${dangerCount > 1 ? "s" : ""}` : "No danger zones"}
            </Badge>
            <Badge variant="default" className="hidden md:inline-flex"><Sparkles className="h-3 w-3" /> AI pipeline live</Badge>
          </>
        }
      />

      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-3 p-3">
        <StatsCards stats={stats} loading={!stats} />

        <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:min-h-[560px]">
          {/* ── tactical map ── */}
          <section aria-label="Live incident map" className="relative h-[52vh] lg:h-auto lg:flex-1">
            <EmergencyMap
              center={DEMO_CENTER}
              zoom={12}
              reports={mapReports}
              zones={zones}
              volunteers={volunteers}
              selectedId={selectedId}
              focusPos={focusPos}
              route={dispatchRoute?.path}
              routeLabel={dispatchRoute ? "Safe approach route" : undefined}
              destination={dispatchTarget}
              fitTo={dispatchRoute?.path}
              onReportClick={(id) => {
                setSelectedId(id);
                const r = reports.find((x) => x.id === id);
                if (r) setFocusPos({ lat: r.latitude, lng: r.longitude });
              }}
              className="h-full"
            />

            {/* legend */}
            <div className="absolute left-3 top-3 z-[600] flex flex-col gap-1.5 rounded-xl border border-white/10 bg-[#0a1128]/85 p-3 text-[11px] backdrop-blur-md">
              {[
                { c: "#3b82f6", l: "Flood" }, { c: "#f97316", l: "Fire" }, { c: "#ef4444", l: "Medical" },
                { c: "#a855f7", l: "Earthquake" }, { c: "#10b981", l: "Volunteer" }, { c: "#f59e0b", l: "Beacon" },
              ].map((i) => (
                <span key={i.l} className="flex items-center gap-2 font-semibold text-slate-300">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: i.c, boxShadow: `0 0 8px ${i.c}` }} /> {i.l}
                </span>
              ))}
            </div>

            {/* selected report action panel */}
            <AnimatePresence>
              {selected && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="absolute inset-x-3 bottom-3 z-[600] lg:left-3 lg:right-auto lg:w-[420px]"
                >
                  <Card className="border-white/15 bg-[#0a1128]/95 shadow-2xl backdrop-blur-md">
                    <div className="flex flex-col gap-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={selected.isFake ? "red" : selected.isVerified ? "green" : "amber"}>
                              {selected.isFake ? "Fake" : selected.isVerified ? "Verified" : "Unverified"}
                            </Badge>
                            <Badge variant="slate" className={severityTone(selected.severity).cls.split(" ")[0]}>SEV {selected.severity}/10</Badge>
                            <Badge variant="slate" className="capitalize">{selected.emergencyType}</Badge>
                            <span className="text-[10px] text-slate-500">{timeAgo(selected.createdAt)}</span>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-slate-100">{selected.aiSummary}</p>
                          <p className="mt-1 line-clamp-2 text-xs italic text-slate-500">&ldquo;{selected.transcript}&rdquo;</p>
                        </div>
                        <button onClick={() => setSelectedId(null)} aria-label="Close details" className="cursor-pointer rounded-lg p-1 text-slate-500 hover:bg-white/10 hover:text-white">
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {/* AI verification transparency */}
                      {notes && (
                        <div className="flex flex-col gap-1.5 rounded-xl bg-white/[0.03] p-3 text-[11px]">
                          <p className="font-bold uppercase tracking-widest text-slate-500">3-layer AI verification · trust {selected.trustScore}%</p>
                          <p className="flex gap-1.5 text-slate-400"><CloudRain className="h-3.5 w-3.5 shrink-0 text-sky-400" />{notes.layerB.note}</p>
                          <p className="flex gap-1.5 text-slate-400"><Users className="h-3.5 w-3.5 shrink-0 text-purple-400" />{notes.layerC.note}</p>
                          {notes.layerA && (
                            <p className="flex gap-1.5 text-slate-400"><ImageIcon className="h-3.5 w-3.5 shrink-0 text-amber-400" />{notes.layerA.reasoning}</p>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <Button size="sm" variant="secondary" onClick={() => act(selected.id, "verify")} disabled={selected.isVerified}>
                          <ShieldCheck className="h-4 w-4 text-emerald-400" /> Verify
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => act(selected.id, "fake")} disabled={selected.isFake}>
                          <ShieldX className="h-4 w-4 text-amber-400" /> Mark fake
                        </Button>
                        <Button size="sm" variant="default" onClick={() => act(selected.id, "dispatch")} disabled={selected.status !== "active"}>
                          <Truck className="h-4 w-4" /> Assign team
                        </Button>
                        <Button size="sm" variant="success" onClick={() => act(selected.id, "resolve")}>
                          <CheckCheck className="h-4 w-4" /> Resolve
                        </Button>
                      </div>

                      {/* Feature 6 — hazard-avoiding responder approach route */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => planDispatchRoute(selected)}
                        disabled={routingBusy}
                      >
                        <Navigation className={cn("h-4 w-4 text-emerald-400", routingBusy && "animate-pulse")} />
                        Plot safe approach route
                      </Button>
                      {dispatchRoute && dispatchTarget && (
                        <p className="flex items-center justify-between rounded-lg border border-emerald-500/25 bg-emerald-500/[0.07] px-2.5 py-2 text-[11px] text-emerald-200">
                          <span>
                            {(dispatchRoute.distanceMeters / 1000).toFixed(1)} km ·{" "}
                            {Math.ceil(dispatchRoute.durationSeconds / 60)} min · avoids{" "}
                            {dispatchRoute.avoidedZones} zone(s)
                          </span>
                          <button
                            onClick={() => {
                              setDispatchRoute(null);
                              setDispatchTarget(null);
                            }}
                            className="cursor-pointer font-bold underline underline-offset-2"
                          >
                            clear
                          </button>
                        </p>
                      )}
                    </div>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* ── sidebar ── */}
          <aside className="flex w-full flex-col gap-3 lg:w-[420px] lg:shrink-0">
            <Tabs
              tabs={[
                { id: "feed", label: <span className="flex items-center gap-1.5"><Radio className="h-3.5 w-3.5" /> Live Feed</span> },
                { id: "drone", label: <span className="flex items-center gap-1.5"><LayoutDashboard className="h-3.5 w-3.5" /> Drone AI</span> },
              ]}
              active={tab}
              onChange={setTab}
            />

            {tab === "feed" ? (
              <>
                {/* filters */}
                <Card className="p-3">
                  <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                    <Filter className="h-3.5 w-3.5" /> Filters
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[10px]">Type</Label>
                      <Select value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))} className="h-9 text-xs" aria-label="Filter by emergency type">
                        <option value="all">All types</option>
                        {Object.keys(EMERGENCY_META).map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px]">Severity</Label>
                      <Select value={String(filters.minSeverity)} onChange={(e) => setFilters((f) => ({ ...f, minSeverity: Number(e.target.value) }))} className="h-9 text-xs" aria-label="Filter by minimum severity">
                        {SEV_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px]">Verified</Label>
                      <Select value={filters.verified} onChange={(e) => setFilters((f) => ({ ...f, verified: e.target.value as Filters["verified"] }))} className="h-9 text-xs" aria-label="Filter by verification status">
                        <option value="all">All</option>
                        <option value="yes">Verified</option>
                        <option value="no">Unverified</option>
                      </Select>
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center gap-5">
                    <span className="flex items-center gap-2 text-xs text-slate-400">
                      <Switch checked={filters.showFakes} onCheckedChange={(v) => setFilters((f) => ({ ...f, showFakes: v }))} aria-label="Show flagged fakes" /> Fakes
                    </span>
                    <span className="flex items-center gap-2 text-xs text-slate-400">
                      <Switch checked={filters.showResolved} onCheckedChange={(v) => setFilters((f) => ({ ...f, showResolved: v }))} aria-label="Show resolved" /> Resolved
                    </span>
                  </div>
                </Card>

                <div className={cn("min-h-0 flex-1 overflow-y-auto pr-1", "lg:max-h-[calc(100vh-430px)]")}>
                  <SOSFeed reports={filtered} loading={loading} selectedId={selectedId} onSelect={selectReport} />
                </div>
              </>
            ) : (
              <Card className="flex-1 overflow-y-auto p-4 lg:max-h-[calc(100vh-280px)]">
                <DroneAnalyzer />
              </Card>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
