import { Link } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Server } from '@/lib/api'
import { formatBytes, getStateColor } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Play,
  Square,
  RotateCw,
  Trash2,
  Loader2,
  Cpu,
  MemoryStick,
  MoreVertical
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
        className={`absolute top-0 left-0 w-1.5 h-full ${getStateColor(server.state)}`}
      />

      <div className="p-6 pb-3 pl-8">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="text-xl font-bold tracking-tight flex items-center gap-2 uppercase">
              <Link
                to="/servers/$serverId"
                params={{ serverId: server.id }}
                className="hover:underline decoration-2 underline-offset-4"
              >
                {server.name}
              </Link>
            </h3>
            <div className="flex items-center gap-2 text-xs font-bold font-mono">
              <Badge
                variant="outline"
                className="text-xs py-0.5 h-6 font-bold bg-muted border-2 border-border rounded-none"
              >
                {server.packId}
              </Badge>
              {primaryPort && (
                <span className="text-muted-foreground">
                  :{primaryPort.hostPort}
                </span>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger className="h-8 w-8 inline-flex items-center justify-center rounded-sm hover:bg-muted">
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="rounded-none border-2 border-border shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]"
            >
              {isStopped && (
                <DropdownMenuItem
                  onClick={() => startMutation.mutate()}
                  disabled={isLoading}
                  className="rounded-none focus:bg-muted cursor-pointer font-bold"
                >
                  <Play className="mr-2 h-4 w-4" /> START
                </DropdownMenuItem>
              )}
              {isRunning && (
                <>
                  <DropdownMenuItem
                    onClick={() => restartMutation.mutate()}
                    disabled={isLoading}
                    className="rounded-none focus:bg-muted cursor-pointer font-bold"
                  >
                    <RotateCw className="mr-2 h-4 w-4" /> RESTART
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => stopMutation.mutate()}
                    disabled={isLoading}
                    className="text-orange-600 dark:text-orange-400 rounded-none focus:bg-orange-50 dark:focus:bg-orange-950/50 cursor-pointer font-bold"
                  >
                    <Square className="mr-2 h-4 w-4" /> STOP
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem
                onClick={() => {
                  if (confirm('Delete this server?')) deleteMutation.mutate()
                }}
                className="text-red-600 dark:text-red-400 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/50 rounded-none cursor-pointer font-bold"
              >
                <Trash2 className="mr-2 h-4 w-4" /> DELETE
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="p-6 pl-8 pt-2">
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground font-mono">
              <Cpu className="h-3.5 w-3.5" />
              <span>CPU</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold tabular-nums">
                {server.stats && isRunning
                  ? server.stats.cpuPercent.toFixed(1)
                  : '0.0'}
              </span>
              <span className="text-xs text-muted-foreground mb-1 font-bold">
                %
              </span>
            </div>
            <div className="h-3 w-full border-2 border-border bg-muted relative">
              <div
                className="h-full bg-foreground transition-all duration-500 ease-out absolute top-0 left-0"
                style={{
                  width: `${Math.min(server.stats?.cpuPercent || 0, 100)}%`
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground font-mono">
              <MemoryStick className="h-3.5 w-3.5" />
              <span>Memory</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold tabular-nums">
                {server.stats && isRunning
                  ? formatBytes(server.stats.memoryUsage)
                  : '0 B'}
              </span>
            </div>
            <div className="h-3 w-full border-2 border-border bg-muted relative">
              <div
                className="h-full bg-foreground transition-all duration-500 ease-out absolute top-0 left-0"
                style={{
                  width: `${Math.min(server.stats?.memoryPercent || 0, 100)}%`
                }}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t-2 border-border pt-4">
          <div className="flex items-center gap-2">
            <div
              className={`h-3 w-3 border border-black dark:border-white ${getStateColor(server.state).split(' ')[0]}`}
            />
            <span className="text-xs font-bold uppercase text-muted-foreground">
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
