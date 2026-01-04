import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Server, ServerState } from '../lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Play,
  Square,
  RotateCw,
  Trash2,
  Plus,
  Server as ServerIcon,
  Loader2,
  Cpu,
  MemoryStick,
  Activity,
  Box,
  MoreVertical
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useHeaderActions } from '@/components/header-actions'

export const Route = createFileRoute('/')({
  component: Dashboard,
  staticData: {
    title: 'Dashboard'
  }
})

function getStateColor(state: ServerState): string {
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

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function ServerCard({ server }: { server: Server }) {
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
            {/* Brutalist Progress Bar */}
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
            {/* Brutalist Progress Bar */}
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

function StatCard({
  title,
  value,
  icon: Icon,
  description
}: {
  title: string
  value: string
  icon: any
  description?: string
}) {
  return (
    <div className="bg-card border-2 border-border p-4">
      <div className="flex flex-row items-center justify-between space-y-0 pb-2">
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
          {title}
        </h3>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1 font-mono">
            {description}
          </p>
        )}
      </div>
    </div>
  )
}

function Dashboard() {
  useHeaderActions(
    <Link to="/servers/new">
      <Button size="sm" className="shadow-sm">
        <Plus className="h-4 w-4 mr-2" />
        New Server
      </Button>
    </Link>
  )

  const {
    data: servers,
    isLoading,
    error
  } = useQuery({
    queryKey: ['servers'],
    queryFn: api.servers.list,
    refetchInterval: 5000
  })

  const stats = {
    total: servers?.length || 0,
    active: servers?.filter((s) => s.state === 'running').length || 0,
    cpu: servers?.reduce((acc, s) => acc + (s.stats?.cpuPercent || 0), 0) || 0,
    memory:
      servers?.reduce((acc, s) => acc + (s.stats?.memoryUsage || 0), 0) || 0
  }

  return (
    <div className="flex flex-1 flex-col gap-8 p-8 pt-6 max-w-7xl mx-auto w-full">
      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Servers"
          value={stats.total.toString()}
          icon={ServerIcon}
        />
        <StatCard
          title="Active Servers"
          value={stats.active.toString()}
          icon={Activity}
          description={`${stats.active} running now`}
        />
        <StatCard
          title="Total CPU Load"
          value={`${stats.cpu.toFixed(1)}%`}
          icon={Cpu}
          description="Across all containers"
        />
        <StatCard
          title="Total Memory"
          value={formatBytes(stats.memory)}
          icon={MemoryStick}
          description="Total allocated RAM"
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Your Servers</h2>
        </div>

        {isLoading && (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <div className="border-2 border-destructive bg-destructive/5 p-6">
            <div className="pt-0">
              <p className="text-destructive font-bold uppercase">
                Failed to load servers: {error.message}
              </p>
            </div>
          </div>
        )}

        {servers && servers.length === 0 && (
          <div className="border-2 border-dashed border-border bg-muted/20 p-12 text-center">
            <div className="flex flex-col items-center justify-center">
              <div className="h-16 w-16 bg-muted border-2 border-border flex items-center justify-center mb-4">
                <Box className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold mb-2 uppercase">
                No servers yet
              </h3>
              <p className="text-muted-foreground max-w-sm mb-6 font-mono text-sm">
                You haven't created any game servers yet. Launch your first
                server to get started.
              </p>
              <Link to="/servers/new">
                <Button className="font-bold border-2 border-primary">
                  <Plus className="h-4 w-4 mr-2" />
                  CREATE FIRST SERVER
                </Button>
              </Link>
            </div>
          </div>
        )}

        {servers && servers.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {servers.map((server) => (
              <ServerCard key={server.id} server={server} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
