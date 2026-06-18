import { cn } from "@/lib/utils"

interface BadgeProps {
  children: React.ReactNode
  variant?: "active" | "offline" | "dormant" | "moving" | "idling" | "stopped" | "critical" | "warning" | "info" | "healthy" | "default"
  className?: string
}

const variantStyles: Record<string, string> = {
  active: "bg-green-500/15 text-green-400 border-green-500/20",
  moving: "bg-green-500/15 text-green-400 border-green-500/20",
  healthy: "bg-green-500/15 text-green-400 border-green-500/20",
  offline: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  idling: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  warning: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  dormant: "bg-red-500/15 text-red-400 border-red-500/20",
  stopped: "bg-slate-500/15 text-slate-400 border-slate-500/20",
  critical: "bg-red-500/15 text-red-400 border-red-500/20",
  info: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  default: "bg-slate-800 text-slate-300 border-slate-700",
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
