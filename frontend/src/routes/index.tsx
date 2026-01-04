import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { formatBytes } from '../lib/utils'
import { Button } from '@/components/ui/button'
import {
  Plus,
  Server as ServerIcon,
  Cpu,
  MemoryStick,
  Activity,
  Box
} from 'lucide-react'
import { useHeaderActions } from '@/components/header-actions'
import { ServerCard } from '@/components/server-card'
import { LoadingSpinner } from '@/components/loading-spinner'
import { ErrorAlert } from '@/components/error-alert'
import { EmptyState } from '@/components/empty-state'

export const Route = createFileRoute('/')({
  component: Dashboard,
  staticData: {
    title: 'Dashboard'
  }
})

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

        {isLoading && <LoadingSpinner />}

        {error && <ErrorAlert message="Failed to load servers" error={error} />}

        {servers && servers.length === 0 && (
          <EmptyState
            icon={Box}
            title="No servers yet"
            description="You haven't created any game servers yet. Launch your first server to get started."
            action={
              <Link to="/servers/new">
                <Button className="font-bold border-2 border-primary">
                  <Plus className="h-4 w-4 mr-2" />
                  CREATE FIRST SERVER
                </Button>
              </Link>
            }
          />
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
