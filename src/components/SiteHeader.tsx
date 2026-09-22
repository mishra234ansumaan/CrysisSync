"use client";

import Link from "next/link";
import { Activity, Radio, HeartHandshake, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/victim", label: "SOS", icon: Radio, id: "victim" },
  { href: "/volunteer", label: "Volunteer", icon: HeartHandshake, id: "volunteer" },
  { href: "/admin", label: "Command", icon: LayoutDashboard, id: "admin" },
] as const;

export default function SiteHeader({
  active,
  right,
  minimal = false,
}: {
  active?: "victim" | "volunteer" | "admin" | "demo" | "home";
  right?: React.ReactNode;
  minimal?: boolean;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0a1128]/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="CrisisSync home">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-b from-red-500 to-red-700 shadow-[0_0_20px_rgba(239,68,68,.5)]">
            <Activity className="h-4.5 w-4.5 text-white" strokeWidth={3} />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-white">
            Crisis<span className="text-red-400">Sync</span>
          </span>
        </Link>

        {!minimal && (
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Primary">
            {NAV.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-all",
                  active === item.id
                    ? "bg-white/[0.08] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.1)]"
                    : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
                )}
              >
                <item.icon className={cn("h-4 w-4", active === item.id && "text-red-400")} />
                {item.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-2">{right}</div>
      </div>
    </header>
  );
}
