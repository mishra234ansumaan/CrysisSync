import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1128] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] cursor-pointer select-none",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-b from-red-500 to-red-600 text-white shadow-[0_8px_30px_-6px_rgba(239,68,68,.55)] hover:from-red-400 hover:to-red-500",
        secondary:
          "bg-white/[0.06] text-slate-100 border border-white/10 hover:bg-white/[0.12] hover:border-white/20",
        outline:
          "border border-white/15 bg-transparent text-slate-200 hover:bg-white/[0.06]",
        ghost: "text-slate-300 hover:bg-white/[0.07] hover:text-white",
        success:
          "bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-[0_8px_30px_-6px_rgba(16,185,129,.5)] hover:from-emerald-400 hover:to-emerald-500",
        warning:
          "bg-gradient-to-b from-amber-500 to-amber-600 text-[#0a1128] shadow-[0_8px_30px_-6px_rgba(245,158,11,.5)] hover:from-amber-400 hover:to-amber-500",
        danger:
          "bg-red-500/15 text-red-300 border border-red-500/40 hover:bg-red-500/25",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 px-3.5 text-xs rounded-lg",
        lg: "h-14 px-8 text-base rounded-2xl",
        xl: "h-16 px-10 text-lg rounded-2xl",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };
