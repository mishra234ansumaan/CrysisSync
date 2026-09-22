"use client";

/**
 * App-wide client providers:
 *  - ToastProvider (notifications)
 *  - OnlineProvider  → Feature 2 offline detection + "Simulate Offline" toggle
 *  - BatteryProvider → Feature 7 battery monitoring + "Simulate 5%" override
 *  - PWA install-prompt capture (usePwaInstall)
 */
import * as React from "react";
import { ToastProvider } from "@/components/ui/toast";

// ────────────────────────────── Online status ─────────────────────────────

interface OnlineContextValue {
  online: boolean; // effective (respects simulation)
  browserOnline: boolean;
  simulatedOffline: boolean;
  setSimulatedOffline: (v: boolean) => void;
}
const OnlineContext = React.createContext<OnlineContextValue>({
  online: true,
  browserOnline: true,
  simulatedOffline: false,
  setSimulatedOffline: () => {},
});
export const useOnline = () => React.useContext(OnlineContext);

function OnlineProvider({ children }: { children: React.ReactNode }) {
  const [browserOnline, setBrowserOnline] = React.useState(true);
  const [simulatedOffline, setSimulatedOffline] = React.useState(false);

  React.useEffect(() => {
    setBrowserOnline(navigator.onLine);
    const up = () => setBrowserOnline(true);
    const down = () => setBrowserOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  const value = React.useMemo(
    () => ({
      online: browserOnline && !simulatedOffline,
      browserOnline,
      simulatedOffline,
      setSimulatedOffline,
    }),
    [browserOnline, simulatedOffline]
  );
  return <OnlineContext.Provider value={value}>{children}</OnlineContext.Provider>;
}

// ─────────────────────────────── Battery ──────────────────────────────────

interface BatteryContextValue {
  level: number; // effective 0-1
  charging: boolean;
  realLevel: number | null;
  supported: boolean;
  simulated: number | null; // simulated level override
  simulateLevel: (v: number | null) => void;
}
const BatteryContext = React.createContext<BatteryContextValue>({
  level: 1,
  charging: false,
  realLevel: null,
  supported: false,
  simulated: null,
  simulateLevel: () => {},
});
export const useBattery = () => React.useContext(BatteryContext);

function BatteryProvider({ children }: { children: React.ReactNode }) {
  const [realLevel, setRealLevel] = React.useState<number | null>(null);
  const [charging, setCharging] = React.useState(false);
  const [simulated, setSimulated] = React.useState<number | null>(null);

  React.useEffect(() => {
    let battery: BatteryManager | null = null;
    const update = () => {
      if (battery) {
        setRealLevel(battery.level);
        setCharging(battery.charging);
      }
    };
    navigator.getBattery?.().then((b) => {
      battery = b;
      update();
      b.addEventListener("levelchange", update);
      b.addEventListener("chargingchange", update);
    });
    return () => {
      battery?.removeEventListener("levelchange", update);
      battery?.removeEventListener("chargingchange", update);
    };
  }, []);

  const value = React.useMemo(
    () => ({
      level: simulated ?? realLevel ?? 0.86,
      charging,
      realLevel,
      supported: realLevel !== null,
      simulated,
      simulateLevel: setSimulated,
    }),
    [simulated, realLevel, charging]
  );
  return <BatteryContext.Provider value={value}>{children}</BatteryContext.Provider>;
}

// ───────────────────────────── PWA install prompt ─────────────────────────

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PwaContextValue {
  canInstall: boolean;
  install: () => Promise<void>;
}
const PwaContext = React.createContext<PwaContextValue>({ canInstall: false, install: async () => {} });
export const usePwaInstall = () => React.useContext(PwaContext);

function PwaProvider({ children }: { children: React.ReactNode }) {
  const [deferred, setDeferred] = React.useState<BeforeInstallPromptEvent | null>(null);

  React.useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = React.useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }, [deferred]);

  return (
    <PwaContext.Provider value={{ canInstall: Boolean(deferred), install }}>
      {children}
    </PwaContext.Provider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <OnlineProvider>
        <BatteryProvider>
          <PwaProvider>{children}</PwaProvider>
        </BatteryProvider>
      </OnlineProvider>
    </ToastProvider>
  );
}
