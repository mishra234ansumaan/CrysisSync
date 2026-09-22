"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "default" | "success" | "danger" | "warning";

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (t: { title: string; description?: string; variant?: ToastVariant }) => void;
}

const ToastContext = React.createContext<ToastContextValue>({ toast: () => {} });
export const useToast = () => React.useContext(ToastContext);

const ICONS: Record<ToastVariant, React.ReactNode> = {
  default: <Info className="h-5 w-5 text-cyan-300" />,
  success: <CheckCircle2 className="h-5 w-5 text-emerald-300" />,
  danger: <XCircle className="h-5 w-5 text-red-300" />,
  warning: <AlertTriangle className="h-5 w-5 text-amber-300" />,
};

const BORDER: Record<ToastVariant, string> = {
  default: "border-cyan-400/30",
  success: "border-emerald-400/30",
  danger: "border-red-500/40",
  warning: "border-amber-400/30",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const idRef = React.useRef(0);

  const toast = React.useCallback(
    ({ title, description, variant = "default" }: { title: string; description?: string; variant?: ToastVariant }) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev.slice(-3), { id, title, description, variant }]);
      window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5200);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-3 top-3 z-[100] flex flex-col items-center gap-2 sm:left-auto sm:right-4 sm:w-[380px] sm:items-end">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
              className={cn(
                "pointer-events-auto flex w-full items-start gap-3 rounded-2xl border bg-[#0e1730]/95 p-4 shadow-2xl backdrop-blur-md",
                BORDER[t.variant]
              )}
              role="alert"
              aria-live="assertive"
            >
              <div className="mt-0.5 shrink-0">{ICONS[t.variant]}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-100">{t.title}</p>
                {t.description && <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{t.description}</p>}
              </div>
              <button
                aria-label="Dismiss notification"
                className="shrink-0 rounded-md p-1 text-slate-500 hover:text-white"
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
