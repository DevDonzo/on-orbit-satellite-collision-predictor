import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide", {
  variants: {
    variant: {
      low: "bg-neon-cyan/20 text-neon-cyan",
      moderate: "bg-neon-amber/20 text-neon-amber",
      high: "bg-neon-coral/20 text-neon-coral",
      critical: "bg-red-500/25 text-red-300",
      neutral: "bg-slate-700/80 text-slate-200"
    }
  },
  defaultVariants: {
    variant: "neutral"
  }
});

type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
