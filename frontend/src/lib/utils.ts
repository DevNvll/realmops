import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { ServerState } from './api'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function getStateColor(state: ServerState, variant: 'indicator' | 'badge' = 'indicator'): string {
  if (variant === 'badge') {
    switch (state) {
      case 'running':
        return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
      case 'starting':
        return 'text-blue-500 bg-blue-500/10 border-blue-500/20 animate-pulse'
      case 'stopping':
        return 'text-orange-500 bg-orange-500/10 border-orange-500/20'
      case 'error':
        return 'text-red-500 bg-red-500/10 border-red-500/20'
      default:
        return 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20'
    }
  }

  // Default 'indicator' variant for server cards
  switch (state) {
    case 'running':
      return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
    case 'starting':
      return 'bg-blue-500 animate-pulse'
    case 'stopping':
      return 'bg-orange-500'
    case 'error':
      return 'bg-red-500'
    default:
      return 'bg-zinc-500'
  }
}
