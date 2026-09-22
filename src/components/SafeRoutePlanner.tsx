"use client";

/**
 * FEATURE 6 — Dynamic Safe-Routing planner.
 *
 * Pick any destination (a relief shelter, or tap anywhere on the map) and the
 * app computes a walking route that bends around every live red danger zone
 * produced by crowd-clustered SOS reports. Road geometry comes from keyless
 * OpenStreetMap/OSRM, with an offline geometric detour engine as fallback.
 */
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Navigation, MapPin, Loader2, ShieldAlert, ShieldCheck, Route as RouteIcon,
  Crosshair, RefreshCw, ExternalLink, Footprints, Clock, TriangleAlert,
} from "lucide-react";
import EmergencyMap from "@/components/EmergencyMap";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { SHELTERS } from "@/lib/constants";
import { haversineMeters, type LatLng } from "@/lib/geo";
import { cn, formatMeters } from "@/lib/utils";
import type { SafeRoute, DangerZone } from "@/lib/routing";
import type { MapZone, MapReport } from "@/components/map/MapView";

interface Destination extends LatLng {
  name: string;
  id: string;
}

const PROVIDER_LABEL: Record<string, string> = {
  "openstreetmap-osrm": "OpenStreetMap roads",
  "offline-geometric": "Offline avoidance engine",
};

export default function SafeRoutePlanner({
  origin,
  reports = [],
  className,
}: {
  origin: LatLng | null;
  reports?: MapReport[];
  className?: string;
}) {
  const { toast } = useToast();
  const [zones, setZones] = React.useState<MapZone[]>([]);
  const [destination, setDestination] = React.useState<Destination | null>(null);
  const [route, setRoute] = React.useState<SafeRoute | null>(null);
  const [provider, setProvider] = React.useState<string>("");
  const [clearsHazards, setClearsHazards] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [pickMode, setPickMode] = React.useState(false);
  const [zonesLoaded, setZonesLoaded] = React.useState(false);

  // Live danger zones, refreshed so a new cluster re-routes the user.
  const loadZones = React.useCallback(async () => {
    try {
      const response = await fetch("/api/sos/clusters");
      const json = (await response.json()) as { clusters?: MapZone[] };
      setZones(json.clusters ?? []);
    } catch {
      /* keep last known zones */
    } finally {
      setZonesLoaded(true);
    }
  }, []);

  React.useEffect(() => {
    loadZones();
    const timer = window.setInterval(loadZones, 15000);
    return () => window.clearInterval(timer);
  }, [loadZones]);

  const dangerZones: DangerZone[] = React.useMemo(
    () =>
      zones
        .filter((zone) => zone.isDangerZone)
        .map((zone) => ({
          lat: zone.center.lat,
          lng: zone.center.lng,
          radiusMeters: Math.max(zone.radiusMeters, 300),
        })),
    [zones]
  );

  const shelterOptions = React.useMemo(() => {
    if (!origin) return SHELTERS.map((s) => ({ ...s, distance: 0 }));
    return [...SHELTERS]
      .map((shelter) => ({ ...shelter, distance: haversineMeters(origin, shelter) }))
      .sort((a, b) => a.distance - b.distance);
  }, [origin]);

  const computeRoute = React.useCallback(
    async (target: Destination) => {
      if (!origin) return;
      setLoading(true);
      setRoute(null);
      try {
        const response = await fetch("/api/routing/safe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ from: origin, to: { lat: target.lat, lng: target.lng }, zones: dangerZones }),
        });
        const json = (await response.json()) as {
          route?: SafeRoute;
          provider?: string;
          clearsHazards?: boolean;
          error?: string;
        };
        if (!response.ok || !json.route) throw new Error(json.error ?? "route unavailable");
        setRoute(json.route);
        setProvider(json.provider ?? "");
        setClearsHazards(json.clearsHazards !== false);
        toast({
          title: "Safe route ready",
          description: `${(json.route.distanceMeters / 1000).toFixed(1)} km · avoids ${json.route.avoidedZones} danger zone${json.route.avoidedZones === 1 ? "" : "s"}.`,
          variant: "success",
        });
      } catch {
        toast({ title: "Could not calculate route", description: "Check connectivity and retry.", variant: "danger" });
      } finally {
        setLoading(false);
      }
    },
    [origin, dangerZones, toast]
  );

  const selectDestination = (target: Destination) => {
    setDestination(target);
    setPickMode(false);
    computeRoute(target);
  };

  const onMapClick = (point: LatLng) => {
    if (!pickMode) return;
    selectDestination({
      id: "custom",
      name: "Chosen destination",
      lat: point.lat,
      lng: point.lng,
    });
  };

  /** Server verdict, double-checked on the client for safety transparency. */
  const routeIsClear = React.useMemo(() => {
    if (!route) return true;
    const geometricallyClear = !route.path.some((point) =>
      dangerZones.some((zone) => haversineMeters(point, zone) < zone.radiusMeters)
    );
    return clearsHazards && geometricallyClear;
  }, [route, dangerZones, clearsHazards]);

  const fitTo = React.useMemo(() => {
    if (route?.path.length) return route.path;
    if (origin && destination) return [origin, destination];
    return undefined;
  }, [route, origin, destination]);

  return (
    <div className={cn("flex flex-col gap-4", className)} id="safe-route">
      {/* destination chooser */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">
            <Navigation className="h-3.5 w-3.5 text-emerald-400" /> Where do you need to go?
          </p>
          <Badge variant={dangerZones.length > 0 ? "red" : "green"}>
            {dangerZones.length > 0
              ? `${dangerZones.length} danger zone${dangerZones.length === 1 ? "" : "s"} active`
              : "No danger zones"}
          </Badge>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {shelterOptions.map((shelter) => {
            const active = destination?.id === shelter.id;
            return (
              <button
                key={shelter.id}
                onClick={() =>
                  selectDestination({ id: shelter.id, name: shelter.name, lat: shelter.lat, lng: shelter.lng })
                }
                disabled={!origin || loading}
                aria-pressed={active}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-xl border p-3 text-left transition-all disabled:opacity-50",
                  active
                    ? "border-emerald-400/60 bg-emerald-500/[0.10]"
                    : "border-white/[0.08] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black",
                    active ? "bg-emerald-500 text-[#04170e]" : "bg-white/[0.07] text-emerald-300"
                  )}
                >
                  H
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-bold text-slate-200">{shelter.name}</span>
                  <span className="text-[11px] text-slate-500">
                    {origin ? `${formatMeters(shelter.distance)} away` : "locating…"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <Button
          variant={pickMode ? "warning" : "outline"}
          size="sm"
          onClick={() => setPickMode((mode) => !mode)}
          disabled={!origin}
          aria-pressed={pickMode}
        >
          <Crosshair className="h-4 w-4" />
          {pickMode ? "Tap the map to drop your destination…" : "Choose any other area on the map"}
        </Button>
      </div>

      {/* route summary */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-xs text-slate-400"
            role="status"
          >
            <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
            Calculating a route that avoids every danger zone…
          </motion.div>
        )}

        {route && !loading && (
          <motion.div
            key={`${destination?.id}-${route.distanceMeters}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-3"
          >
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.04] p-2.5">
                <p className="flex items-center justify-center gap-1 font-display text-lg font-bold text-emerald-300">
                  <Footprints className="h-4 w-4" /> {(route.distanceMeters / 1000).toFixed(1)} km
                </p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Distance</p>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.04] p-2.5">
                <p className="flex items-center justify-center gap-1 font-display text-lg font-bold text-emerald-300">
                  <Clock className="h-4 w-4" /> {Math.max(1, Math.ceil(route.durationSeconds / 60))} min
                </p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">On foot</p>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.04] p-2.5">
                <p className="flex items-center justify-center gap-1 font-display text-lg font-bold text-red-300">
                  <ShieldAlert className="h-4 w-4" /> {route.avoidedZones}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Zones avoided</p>
              </div>
            </div>

            <div
              className={cn(
                "flex items-start gap-2 rounded-xl border p-3 text-xs",
                routeIsClear
                  ? "border-emerald-500/30 bg-emerald-500/[0.07] text-emerald-200"
                  : "border-amber-500/40 bg-amber-500/[0.09] text-amber-200"
              )}
              role="status"
            >
              {routeIsClear ? (
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <p className="leading-relaxed">
                {routeIsClear ? (
                  <>
                    <span className="font-bold">Route is clear.</span> The green path to{" "}
                    <span className="font-bold">{destination?.name}</span> stays outside every red danger
                    zone. Follow it and do not enter shaded red areas.
                  </>
                ) : (
                  <>
                    <span className="font-bold">Caution:</span> no fully clear path exists right now. This is
                    the safest available route — move quickly and stay alert near red areas.
                  </>
                )}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* the map */}
      <div className={cn("relative h-[420px] w-full", pickMode && "ring-2 ring-amber-400/60 rounded-2xl")}>
        {origin && zonesLoaded ? (
          <EmergencyMap
            center={origin}
            zoom={13}
            userPos={origin}
            zones={zones}
            reports={reports}
            hideResolved
            route={route?.path}
            routeLabel={route && destination ? `Safe route → ${destination.name}` : undefined}
            destination={destination}
            fitTo={fitTo}
            showShelters
            onMapClick={onMapClick}
            className="h-full"
          />
        ) : (
          <Skeleton className="h-full w-full" />
        )}

        {pickMode && (
          <div className="pointer-events-none absolute left-1/2 top-3 z-[600] -translate-x-1/2 rounded-full border border-amber-400/50 bg-[#0a1128]/90 px-3 py-1.5 text-[11px] font-bold text-amber-200 backdrop-blur">
            Tap anywhere to set your destination
          </div>
        )}

        {/* map legend */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-[600] flex flex-col gap-1 rounded-xl border border-white/10 bg-[#0a1128]/85 p-2.5 text-[10px] font-semibold backdrop-blur">
          <span className="flex items-center gap-2 text-emerald-300">
            <span className="h-0.5 w-5 rounded bg-emerald-400" /> Safe route
          </span>
          <span className="flex items-center gap-2 text-red-300">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/60 ring-1 ring-red-400" /> Danger zone
          </span>
          <span className="flex items-center gap-2 text-sky-300">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-400" /> You
          </span>
        </div>
      </div>

      {/* actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => destination && computeRoute(destination)}
          disabled={!destination || loading}
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Recalculate with live zones
        </Button>
        {destination && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&origin=${origin?.lat},${origin?.lng}&destination=${destination.lat},${destination.lng}&travelmode=walking`}
            target="_blank"
            rel="noreferrer"
          >
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4" /> Open in Maps
            </Button>
          </a>
        )}
        {provider && (
          <span className="flex items-center gap-1.5 self-center text-[11px] text-slate-500">
            <RouteIcon className="h-3.5 w-3.5" />
            {PROVIDER_LABEL[provider] ?? provider}
          </span>
        )}
      </div>

      {!destination && !loading && (
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <MapPin className="h-3.5 w-3.5" />
          Pick a shelter above or tap the map — the route will automatically bend around active danger zones.
        </p>
      )}
    </div>
  );
}
