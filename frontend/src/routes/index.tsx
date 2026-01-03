import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "../lib/api"
import type { Server, ServerState } from "../lib/api"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Play,
  Square,
  RotateCw,
  Trash2,
  Plus,
  Server as ServerIcon,
  Loader2,
} from "lucide-react"

export const Route = createFileRoute("/")({
  component: Dashboard,
})

function getStateBadgeVariant(
  state: ServerState
): "default" | "secondary" | "destructive" | "outline" {
  switch (state) {
    case "running":
      return "default"
    case "starting":
    case "stopping":
      return "secondary"
    case "error":
      return "destructive"
    default:
      return "outline"
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function ServerCard({ server }: { server: Server }) {
  const queryClient = useQueryClient()

  const startMutation = useMutation({
    mutationFn: () => api.servers.start(server.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["servers"] }),
  })

  const stopMutation = useMutation({
    mutationFn: () => api.servers.stop(server.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["servers"] }),
  })

  const restartMutation = useMutation({
    mutationFn: () => api.servers.restart(server.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["servers"] }),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.servers.delete(server.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["servers"] }),
  })

  const isLoading =
    startMutation.isPending ||
    stopMutation.isPending ||
    restartMutation.isPending
  const isRunning = server.state === "running"
  const isStopped = server.state === "stopped"
  const primaryPort = server.ports[0]

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            <Link
              to="/servers/$serverId"
              params={{ serverId: server.id }}
              className="hover:text-primary transition-colors"
            >
              {server.name}
            </Link>
          </CardTitle>
          <Badge variant={getStateBadgeVariant(server.state)}>
            {server.state}
          </Badge>
        </div>
        <CardDescription>
          {server.packId}{" "}
          {primaryPort && `• ${primaryPort.hostPort}/${primaryPort.protocol}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {server.stats && isRunning && (
          <div className="text-sm text-muted-foreground mb-4 grid grid-cols-2 gap-2">
            <div>CPU: {server.stats.cpuPercent.toFixed(1)}%</div>
            <div>RAM: {formatBytes(server.stats.memoryUsage)}</div>
          </div>
        )}
        <div className="flex gap-2">
          {isStopped && (
            <Button
              size="sm"
              onClick={() => startMutation.mutate()}
              disabled={isLoading}
            >
              {startMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              <span className="ml-1">Start</span>
            </Button>
          )}
          {isRunning && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => stopMutation.mutate()}
                disabled={isLoading}
              >
                {stopMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                <span className="ml-1">Stop</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => restartMutation.mutate()}
                disabled={isLoading}
              >
                {restartMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCw className="h-4 w-4" />
                )}
                <span className="ml-1">Restart</span>
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              if (confirm("Delete this server?")) deleteMutation.mutate()
            }}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Dashboard() {
  const {
    data: servers,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["servers"],
    queryFn: api.servers.list,
    refetchInterval: 5000,
  })

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <ServerIcon className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold">Servers</h1>
        </div>
        <Link to="/servers/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Server
          </Button>
        </Link>
      </div>

      {isLoading && (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">
              Failed to load servers: {error.message}
            </p>
          </CardContent>
        </Card>
      )}

      {servers && servers.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-center py-12">
            <ServerIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No servers yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first game server to get started.
            </p>
            <Link to="/servers/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Server
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {servers && servers.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {servers.map((server) => (
            <ServerCard key={server.id} server={server} />
          ))}
        </div>
      )}
    </div>
  )
}
