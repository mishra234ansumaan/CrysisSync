import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider",
  {
    variants: {
      variant: {
        default: "border-cyan-400/30 bg-cyan-400/10 text-cyan-300",
        red: "border-red-500/40 bg-red-500/15 text-red-300",
        green: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
        amber: "border-amber-500/40 bg-amber-500/15 text-amber-300",
        blue: "border-blue-500/40 bg-blue-500/15 text-blue-300",
        purple: "border-purple-500/40 bg-purple-500/15 text-purple-300",
        slate: "border-white/15 bg-white/[0.06] text-slate-300",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
