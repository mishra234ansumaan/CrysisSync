"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Tabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: { id: string; label: React.ReactNode }[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center gap-1 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-1",
        className
      )}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200",
            active === t.id
              ? "bg-cyan-400/15 text-cyan-300 shadow-[inset_0_0_0_1px_rgba(34,211,238,.25)]"
              : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
