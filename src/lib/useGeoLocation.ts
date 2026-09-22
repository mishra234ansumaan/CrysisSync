"use client";

/**
 * Browser Geolocation hook with demo-safe fallback.
 * If GPS is unavailable/denied within 6s we fall back to the demo epicenter
 * so the stage demo never stalls (marked as such via `isFallback`).
 */
import * as React from "react";
import { DEMO_CENTER } from "./constants";
import type { LatLng } from "./geo";

export function useGeoLocation() {
  const [pos, setPos] = React.useState<LatLng | null>(null);
  const [isFallback, setIsFallback] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const fallbackTimer = window.setTimeout(() => {
      if (!cancelled) {
        setPos((p) => p ?? { ...DEMO_CENTER });
        setIsFallback(true);
      }
    }, 6000);

    if (!navigator.geolocation) {
      window.clearTimeout(fallbackTimer);
      setPos({ ...DEMO_CENTER });
      setIsFallback(true);
      setError("Geolocation not supported — using demo location");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (p) => {
        if (cancelled) return;
        window.clearTimeout(fallbackTimer);
        setIsFallback(false);
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
      },
      () => {
        if (cancelled) return;
        window.clearTimeout(fallbackTimer);
        setPos((p) => p ?? { ...DEMO_CENTER });
        setIsFallback(true);
        setError("GPS unavailable — using demo location");
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 8000 }
    );

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  return { pos, isFallback, error };
}
