"use client";

/**
 * FEATURE 7 — Battery-Death Beacon monitor chip.
 * Uses navigator.getBattery() (with graceful degradation). When the
 * effective level drops to ≤5% it fires onCriticalChange(true) so the
 * parent page can auto-send the LAST_GASP_BEACON SOS and switch the UI
 * to grayscale power-saving mode.
 */
import * as React from "react";
import { Battery, BatteryCharging, BatteryFull, BatteryLow, BatteryMedium, BatteryWarning } from "lucide-react";
import { useBattery } from "@/components/providers";
import { cn } from "@/lib/utils";

export default function BatteryMonitor({
  onCriticalChange,
}: {
  onCriticalChange?: (critical: boolean) => void;
}) {
  const battery = useBattery();
  const pct = Math.round(battery.level * 100);
  const critical = pct <= 5;
  const fired = React.useRef(false);

  React.useEffect(() => {
    if (critical && !fired.current) {
      fired.current = true;
      onCriticalChange?.(true);
    }
    if (!critical && fired.current) {
      fired.current = false;
      onCriticalChange?.(false);
    }
  }, [critical, onCriticalChange]);

  const Icon = battery.charging
    ? BatteryCharging
    : critical
      ? BatteryWarning
      : pct <= 20
        ? BatteryLow
        : pct <= 50
          ? BatteryMedium
          : pct >= 90
            ? BatteryFull
            : Battery;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold tabular-nums",
        critical
          ? "animate-pulse border-red-500/60 bg-red-500/15 text-red-300"
          : pct <= 20
            ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
            : "border-white/10 bg-white/[0.05] text-slate-300"
      )}
      role="status"
      aria-label={`Battery ${pct} percent${battery.charging ? ", charging" : ""}`}
      title={battery.supported ? "Live battery telemetry" : "Battery API unavailable — showing estimate"}
    >
      <Icon className="h-4 w-4" />
      {pct}%
      {battery.simulated !== null && <span className="ml-1 rounded bg-white/10 px-1 text-[9px] uppercase">sim</span>}
    </div>
  );
}
