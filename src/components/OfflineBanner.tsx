"use client";

/**
 * FEATURE 2 — Offline mode banner. Appears whenever connectivity drops
 * (real or simulated) and explains the SMS fallback flow.
 */
import { motion, AnimatePresence } from "framer-motion";
import { SignalZero, MessageSquare } from "lucide-react";
import { useOnline } from "@/components/providers";

export default function OfflineBanner() {
  const { online, simulatedOffline } = useOnline();
  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden border-b border-amber-500/30 bg-amber-500/15"
          role="alert"
        >
          <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-2.5">
            <SignalZero className="h-4 w-4 shrink-0 animate-pulse text-amber-300" />
            <p className="text-xs font-semibold text-amber-200">
              OFFLINE MODE ACTIVE{simulatedOffline ? " (simulated)" : ""} — your SOS will be encoded as an
              SMS micro-code.
              <span className="ml-1 inline-flex items-center gap-1 text-amber-300/80">
                <MessageSquare className="h-3 w-3" /> Zero internet required
              </span>
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
