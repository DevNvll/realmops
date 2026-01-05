import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
    Box,
    Check,
    Copy,
    Cpu,
    FolderOpen,
    Key,
    Loader2,
    MemoryStick,
    Network,
    Play,
    RotateCw,
    Settings,
    Square,
    Terminal,
    TerminalSquare,
    Trash2
} from 'lucide-react'
import { useState } from 'react'
import { ErrorAlert } from '../../components/error-alert'
import { LoadingSpinner } from '../../components/loading-spinner'
import { ConsoleTab } from '../../components/server/ConsoleTab'
import { EditServerDialog } from '../../components/server/EditServerDialog'
import { FilesTab } from '../../components/server/FilesTab'
import { LogsTab } from '../../components/server/LogsTab'
import { SFTPTab } from '../../components/server/SFTPTab'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from '../../components/ui/tabs'
import { useHostIP } from '../../hooks/use-host-ip'
import { api } from '../../lib/api'
import { formatBytes, getStateColor } from '../../lib/utils'

export const Route = createFileRoute('/servers/$serverId')({
  component: ServerDetailPage,
  staticData: {
    title: 'Server Details'
  }
})

function ServerDetailPage() {
  const { serverId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const hostIP = useHostIP()
  const [copied, setCopied] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  const copyServerAddress = (port: number) => {
    const address = `${hostIP}:${port}`
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const {
    data: server,
    isLoading,
    error
  } = useQuery({
    queryKey: ['server', serverId],
    queryFn: () => api.servers.get(serverId),
    refetchInterval: 5000
  })

  const { data: pack } = useQuery({
    queryKey: ['pack', server?.packId],
    queryFn: () => api.packs.get(server!.packId),
    enabled: !!server?.packId
  })

  const startMutation = useMutation({
    mutationFn: () => api.servers.start(serverId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['server', serverId] })
  })

  const stopMutation = useMutation({
    mutationFn: () => api.servers.stop(serverId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['server', serverId] })
  })

  const restartMutation = useMutation({
    mutationFn: () => api.servers.restart(serverId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['server', serverId] })
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.servers.delete(serverId),
    onSuccess: () => navigate({ to: '/' })
  })

  if (isLoading) {
    return <LoadingSpinner className="h-[calc(100vh-4rem)]" />
  }

  if (error || !server) {
    return (
      <div className="container mx-auto p-8">
        <ErrorAlert message="Failed to load server" error={error || new Error('Not found')} />
      </div>
    )
  }

  const isRunning = server.state === 'running'
  const isStopped = server.state === 'stopped'
  const isLoadingAction =
    startMutation.isPending ||
    stopMutation.isPending ||
    restartMutation.isPending

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-4rem)] overflow-hidden">
      {/* Hero Header */}
      <div className="bg-background border-b-2 border-border px-8 py-6">
        <div className="max-w-7xl mx-auto w-full">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 bg-muted flex items-center justify-center border-2 border-border">
                <Box className="h-8 w-8 text-foreground" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold tracking-tight uppercase">
                    {server.name}
                  </h1>
                  <Badge
                    variant="outline"
                    className={`${getStateColor(server.state, 'badge')} border-2 rounded-none`}
                  >
                    {server.state}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Box className="h-3.5 w-3.5" />
                    <span>{server.packId}</span>
                  </div>
                  {server.ports.length > 0 && (
                    <button
                      onClick={() => copyServerAddress(server.ports[0].hostPort)}
                      className="flex items-center gap-1.5 bg-muted px-1.5 py-0.5 border border-border text-xs text-foreground hover:bg-muted/80 hover:border-primary/50 transition-colors cursor-pointer"
                      title="Click to copy server address"
                    >
                      <Network className="h-3 w-3" />
                      <span>{hostIP}:{server.ports[0].hostPort}</span>
                      {copied ? (
                        <Check className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <Copy className="h-3 w-3 opacity-50" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Server Control Actions */}
              <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/50 p-1 rounded-lg">
                {isStopped ? (
                  <Button
                    onClick={() => startMutation.mutate()}
                    disabled={isLoadingAction}
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-none h-8 px-3"
                  >
                    {startMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5 mr-1.5 fill-current" />
                    )}
                    Start
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={() => restartMutation.mutate()}
                      disabled={isLoadingAction}
                      size="sm"
                      variant="ghost"
                      className="h-8 px-3 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    >
                      {restartMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      ) : (
                        <RotateCw className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Restart
                    </Button>
                    <Button
                      onClick={() => stopMutation.mutate()}
                      disabled={isLoadingAction}
                      size="sm"
                      variant="ghost"
                      className="h-8 px-3 text-amber-600 hover:text-amber-700 hover:bg-amber-100 dark:text-amber-500 dark:hover:bg-amber-500/10"
                    >
                      {stopMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      ) : (
                        <Square className="h-3.5 w-3.5 mr-1.5 fill-current" />
                      )}
                      Stop
                    </Button>
                  </>
                )}
              </div>

              {/* Settings Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditDialogOpen(true)}
                className="h-8 w-8 p-0 text-zinc-400 hover:text-foreground hover:bg-muted"
                title="Edit server settings"
              >
                <Settings className="h-4 w-4" />
              </Button>

              {/* Destructive Action - Separated */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm('Are you sure you want to delete this server? This action cannot be undone.')) deleteMutation.mutate()
                }}
                disabled={deleteMutation.isPending}
                className="h-8 w-8 p-0 text-zinc-400 hover:text-red-500 hover:bg-red-500/10"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Quick Stats */}
          {server.stats && isRunning && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-6 border-t-2 border-border">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 font-mono uppercase">
                  <Cpu className="h-3.5 w-3.5" /> CPU Usage
                </div>
                <div className="text-xl font-semibold tabular-nums">
                  {server.stats.cpuPercent.toFixed(1)}%
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 font-mono uppercase">
                  <MemoryStick className="h-3.5 w-3.5" /> Memory
                </div>
                <div className="text-xl font-bold tabular-nums">
                  {formatBytes(server.stats.memoryUsage)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <Tabs defaultValue="logs" className="h-full flex flex-col gap-0">
          <div className="px-8 border-b-2 border-border bg-background">
            <div className="max-w-7xl mx-auto w-full">
              <TabsList className="h-12 w-full justify-start gap-0 bg-transparent p-0 border-0">
                <TabsTrigger
                  value="logs"
                  className="!border-0 !border-b-4 !border-b-transparent data-[state=active]:!border-0 data-[state=active]:!border-b-4 data-[state=active]:!border-b-primary data-[state=active]:!bg-transparent data-[state=active]:!shadow-none data-[state=active]:!text-foreground rounded-none h-full px-6 font-bold uppercase !text-muted-foreground hover:!text-foreground hover:bg-muted/50 transition-none"
                >
                  <Terminal className="h-4 w-4 mr-2" />
                  Logs
                </TabsTrigger>
                <TabsTrigger
                  value="console"
                  className="!border-0 !border-b-4 !border-b-transparent data-[state=active]:!border-0 data-[state=active]:!border-b-4 data-[state=active]:!border-b-primary data-[state=active]:!bg-transparent data-[state=active]:!shadow-none data-[state=active]:!text-foreground rounded-none h-full px-6 font-bold uppercase !text-muted-foreground hover:!text-foreground hover:bg-muted/50 transition-none"
                >
                  <TerminalSquare className="h-4 w-4 mr-2" />
                  Console
                </TabsTrigger>
                <TabsTrigger
                  value="files"
                  className="!border-0 !border-b-4 !border-b-transparent data-[state=active]:!border-0 data-[state=active]:!border-b-4 data-[state=active]:!border-b-primary data-[state=active]:!bg-transparent data-[state=active]:!shadow-none data-[state=active]:!text-foreground rounded-none h-full px-6 font-bold uppercase !text-muted-foreground hover:!text-foreground hover:bg-muted/50 transition-none"
                >
                  <FolderOpen className="h-4 w-4 mr-2" />
                  File Manager
                </TabsTrigger>
                <TabsTrigger
                  value="sftp"
                  className="!border-0 !border-b-4 !border-b-transparent data-[state=active]:!border-0 data-[state=active]:!border-b-4 data-[state=active]:!border-b-primary data-[state=active]:!bg-transparent data-[state=active]:!shadow-none data-[state=active]:!text-foreground rounded-none h-full px-6 font-bold uppercase !text-muted-foreground hover:!text-foreground hover:bg-muted/50 transition-none"
                >
                  <Key className="h-4 w-4 mr-2" />
                  SFTP
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            {/* Logs Tab - Full Width */}
            <TabsContent
              value="logs"
              className="h-full mt-0 data-[state=active]:flex flex-col"
            >
              <LogsTab
                serverId={serverId}
                containerID={server.dockerContainerId}
              />
            </TabsContent>

            {/* Console Tab - Full Width */}
            <TabsContent
              value="console"
              className="h-full mt-0 data-[state=active]:flex flex-col"
            >
              <ConsoleTab
                serverId={serverId}
                serverState={server.state}
                rconEnabled={pack?.rcon?.enabled ?? false}
                isInstalled={!!server.dockerContainerId}
              />
            </TabsContent>

            {/* Files Tab - Constrained Width */}
            <TabsContent
              value="files"
              className="h-full mt-0 data-[state=active]:flex flex-col p-8 bg-muted/20"
            >
              <div className="max-w-7xl mx-auto w-full h-full">
                <FilesTab serverId={serverId} />
              </div>
            </TabsContent>

            {/* SFTP Tab */}
            <TabsContent
              value="sftp"
              className="h-full mt-0 data-[state=active]:flex flex-col p-8 overflow-auto"
            >
              <SFTPTab serverId={serverId} />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Edit Server Dialog */}
      <EditServerDialog
        server={server}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </div>
  )
}
