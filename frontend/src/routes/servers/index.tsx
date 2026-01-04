import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Button } from '@/components/ui/button'
import { Plus, Server as ServerIcon } from 'lucide-react'
import { useHeaderActions } from '@/components/header-actions'
import { ServerCard } from '@/components/server-card'
import { LoadingSpinner } from '@/components/loading-spinner'
import { ErrorAlert } from '@/components/error-alert'
import { EmptyState } from '@/components/empty-state'

export const Route = createFileRoute('/servers/')({
  component: ServersPage,
  staticData: {
    title: 'Servers'
  }
})

function ServersPage() {
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

  return (
    <div className="flex flex-1 flex-col gap-8 p-8 pt-6 max-w-7xl mx-auto w-full">
      <div>
        <p className="text-muted-foreground mt-1">
          Manage your game servers, view their status, and control their lifecycle.
        </p>
      </div>

      {isLoading && <LoadingSpinner />}

      {error && <ErrorAlert message="Failed to load servers" error={error} />}

      {servers && servers.length === 0 && (
        <EmptyState
          icon={ServerIcon}
          title="No servers yet"
          description="You haven't created any game servers yet. Create your first server to get started."
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
  )
}
