"use client";

/**
 * EmergencyMap — public map component. Leaflet must never render on the
 * server, so the real implementation is dynamically imported (ssr: false).
 */
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { EmergencyMapProps } from "./map/MapView";

const MapView = dynamic(() => import("./map/MapView"), {
  ssr: false,
  loading: () => (
    <div className="relative h-full w-full overflow-hidden rounded-2xl">
      <Skeleton className="h-full w-full" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Loading tactical map…
        </span>
      </div>
    </div>
  ),
});

export default function EmergencyMap(props: EmergencyMapProps) {
  return <MapView {...props} />;
}
