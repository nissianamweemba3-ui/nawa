import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmt(n: number) {
  return n.toLocaleString("en-US")
}

export function fmt1(n: number) {
  return Number(n).toLocaleString("en-US", { maximumFractionDigits: 1 })
}

export function fmtPct(n: number) {
  return `${n.toFixed(1)}%`
}

export function statusColor(status: string) {
  const map: Record<string, string> = {
    moving: "#34d399",
    idling: "#f5a623",
    stopped: "#94a3b8",
    offline: "#5b6b82",
    active: "#16a34a",
    dormant: "#ef4444",
    healthy: "#34d399",
    warning: "#f59e0b",
    critical: "#ef4444",
  }
  return map[status?.toLowerCase()] ?? "#94a3b8"
}

export function riskColor(risk: string) {
  if (risk === "High") return "#f87171"
  if (risk === "Medium") return "#f5a623"
  return "#34d399"
}

export function safetyColor(score: number) {
  if (score >= 90) return "#34d399"
  if (score >= 78) return "#2dd4bf"
  if (score >= 65) return "#f5a623"
  return "#f87171"
}

export function timeAgo(date: Date | string): string {
  const now = new Date()
  const then = new Date(date)
  const diff = Math.floor((now.getTime() - then.getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function daysBetween(date: Date | string): number {
  const now = new Date()
  const then = new Date(date)
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24))
}
