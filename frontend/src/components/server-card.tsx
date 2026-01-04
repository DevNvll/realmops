import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Server } from '@/lib/api'
import { formatBytes, getStateColor } from '@/lib/utils'
import { useHostIP } from '@/hooks/use-host-ip'
import { Badge } from '@/components/ui/badge'
import {
  Play,
  Square,
  RotateCw,
  Trash2,
  Loader2,
  Cpu,
  MemoryStick,
  MoreVertical,
  Copy,
  Check
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

interface ServerCardProps {
  server: Server
}

export function ServerCard({ server }: ServerCardProps) {
  const queryClient = useQueryClient()
  const hostIP = useHostIP()
  const [copied, setCopied] = useState(false)

  const copyServerAddress = (port: number) => {
    const address = `${hostIP}:${port}`
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const startMutation = useMutation({
    mutationFn: () => api.servers.start(server.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['servers'] })
  })

  const stopMutation = useMutation({
    mutationFn: () => api.servers.stop(server.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['servers'] })
  })

  const restartMutation = useMutation({
    mutationFn: () => api.servers.restart(server.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['servers'] })
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.servers.delete(server.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['servers'] })
  })

  const isLoading =
    startMutation.isPending ||
    stopMutation.isPending ||
    restartMutation.isPending
  const isRunning = server.state === 'running'
  const isStopped = server.state === 'stopped'
  const primaryPort = server.ports[0]

  return (
    <div className="group relative overflow-hidden border bg-card">
      <div
        className={`absolute top-0 left-0 w-1 h-full ${getStateColor(server.state)}`}
      />

      <div className="p-6 pb-3 pl-7">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
              <Link
                to="/servers/$serverId"
                params={{ serverId: server.id }}
                className="hover:underline underline-offset-4"
              >
                {server.name}
              </Link>
            </h3>
            <div className="flex items-center gap-2 text-xs">
              <Badge
                variant="secondary"
                className="text-xs py-0.5 h-6 font-medium"
              >
                {server.packId}
              </Badge>
              {primaryPort && (
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    copyServerAddress(primaryPort.hostPort)
                  }}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                  title="Click to copy server address"
                >
                  <span>:{primaryPort.hostPort}</span>
                  {copied ? (
                    <Check className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <Copy className="h-3 w-3 opacity-50" />
                  )}
                </button>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger className="h-8 w-8 inline-flex items-center justify-center hover:bg-muted">
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-36"
            >
              {isStopped && (
                <DropdownMenuItem
                  onClick={() => startMutation.mutate()}
                  disabled={isLoading}
                  className="cursor-pointer"
                >
                  <Play className="mr-2 h-4 w-4" />
                  Restart
                </DropdownMenuItem>
              )}
              {isRunning && (
                <>
                  <DropdownMenuItem
                    onClick={() => restartMutation.mutate()}
                    disabled={isLoading}
                    className="cursor-pointer"
                  >
                    <RotateCw className="mr-2 h-4 w-4" />
                    Restart
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => stopMutation.mutate()}
                    disabled={isLoading}
                    className="cursor-pointer"
                  >
                    <Square className="mr-2 h-4 w-4" />
                    Stop
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem
                onClick={() => {
                  if (confirm('Delete this server?')) deleteMutation.mutate()
                }}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="p-6 pl-7 pt-2">
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Cpu className="h-3.5 w-3.5" />
              <span>CPU</span>
            </div>
            <div className="flex items-end gap-1">
              <span className="text-2xl font-semibold tabular-nums">
                {server.stats && isRunning
                  ? server.stats.cpuPercent.toFixed(1)
                  : '0.0'}
              </span>
              <span className="text-sm text-muted-foreground mb-0.5">%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-foreground/80 transition-all duration-500 ease-out rounded-full"
                style={{
                  width: `${Math.min(server.stats?.cpuPercent || 0, 100)}%`
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MemoryStick className="h-3.5 w-3.5" />
              <span>Memory</span>
            </div>
            <div className="flex items-end gap-1">
              <span className="text-2xl font-semibold tabular-nums">
                {server.stats && isRunning
                  ? formatBytes(server.stats.memoryUsage)
                  : '0 B'}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-foreground/80 transition-all duration-500 ease-out rounded-full"
                style={{
                  width: `${Math.min(server.stats?.memoryPercent || 0, 100)}%`
                }}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t pt-4">
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${getStateColor(server.state).split(' ')[0]}`}
            />
            <span className="text-xs text-muted-foreground capitalize">
              {server.state}
            </span>
          </div>

          {!isRunning && !isStopped && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>
    </div>
  )
}
