import { cn } from '@/lib/utils'

type ConnectionStatus = 'connected' | 'disconnected' | 'connecting'

interface ConnectionStatusBadgeProps {
  status: ConnectionStatus
  label?: string
  className?: string
}

const statusConfig: Record<ConnectionStatus, { color: string; label: string }> = {
  connected: { color: 'bg-emerald', label: 'Live' },
  disconnected: { color: 'bg-red', label: 'Disconnected' },
  connecting: { color: 'bg-amber', label: 'Connecting' }
}

export function ConnectionStatusBadge({ status, label, className }: ConnectionStatusBadgeProps) {
  const config = statusConfig[status]
  const displayLabel = label ?? config.label

  return (
    <div className={cn(
      'flex items-center gap-1.5 bg-zinc-900/80 backdrop-blur-sm px-2 py-1 rounded text-xs',
      className
    )}>
      <span className="relative flex h-2 w-2">
        <span className={cn(
          'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
          status === 'connected' && 'bg-emerald-400',
          status === 'disconnected' && 'bg-red-400',
          status === 'connecting' && 'bg-amber-400'
        )} />
        <span className={cn(
          'relative inline-flex rounded-full h-2 w-2',
          status === 'connected' && 'bg-emerald-500',
          status === 'disconnected' && 'bg-red-500',
          status === 'connecting' && 'bg-amber-500'
        )} />
      </span>
      <span className="text-zinc-400">{displayLabel}</span>
    </div>
  )
}
