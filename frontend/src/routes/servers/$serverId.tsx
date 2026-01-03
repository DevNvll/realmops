import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { ServerState, FileEntry } from '../../lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { ScrollArea } from '../../components/ui/scroll-area'
import { Textarea } from '../../components/ui/textarea'
import {
  Play, Square, RotateCw, Trash2, ArrowLeft, Loader2,
  Terminal, FolderOpen, FileText, Folder, Save, RefreshCw, TerminalSquare
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { ConsoleTab } from '../../components/server/ConsoleTab'

export const Route = createFileRoute('/servers/$serverId')({
  component: ServerDetailPage,
})

function getStateBadgeVariant(state: ServerState): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (state) {
    case 'running': return 'default'
    case 'starting': case 'stopping': return 'secondary'
    case 'error': return 'destructive'
    default: return 'outline'
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function LogsTab({ serverId, containerID }: { serverId: string; containerID?: string }) {
  const [logs, setLogs] = useState<string[]>([])
  const [connectionError, setConnectionError] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const retryTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    if (!containerID) return

    const connect = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return

      const wsUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api')
        .replace('http', 'ws').replace('/api', '')
      const ws = new WebSocket(`${wsUrl}/api/servers/${serverId}/logs/stream`)
      wsRef.current = ws

      ws.onopen = () => {
        setConnectionError(false)
      }

      ws.onmessage = (event) => {
        setLogs((prev) => [...prev.slice(-500), event.data])
      }

      ws.onerror = () => {
        setConnectionError(true)
      }

      ws.onclose = () => {
        // Retry connection after 2 seconds if container exists
        if (containerID) {
          retryTimeoutRef.current = window.setTimeout(connect, 2000)
        }
      }
    }

    connect()

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
      wsRef.current?.close()
    }
  }, [serverId, containerID])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [logs])

  if (!containerID) {
    return <p className="text-muted-foreground">Server not installed yet.</p>
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setLogs([])}>
          <RefreshCw className="h-4 w-4 mr-2" />Clear
        </Button>
        {connectionError && (
          <span className="text-xs text-muted-foreground">Connecting...</span>
        )}
      </div>
      <ScrollArea ref={scrollRef} className="h-96 w-full rounded border bg-black p-4">
        <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
          {logs.length === 0 ? 'Waiting for logs...' : logs.join('')}
        </pre>
      </ScrollArea>
    </div>
  )
}

function FilesTab({ serverId }: { serverId: string }) {
  const [currentPath, setCurrentPath] = useState('')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState('')
  const [saving, setSaving] = useState(false)

  const { data: files, isLoading } = useQuery({
    queryKey: ['server-files', serverId, currentPath],
    queryFn: () => api.servers.files.list(serverId, currentPath),
  })

  const handleNavigate = (entry: FileEntry) => {
    if (entry.isDir) {
      setCurrentPath(currentPath ? `${currentPath}/${entry.name}` : entry.name)
      setSelectedFile(null)
    } else {
      const filePath = currentPath ? `${currentPath}/${entry.name}` : entry.name
      setSelectedFile(filePath)
      api.servers.files.get(serverId, filePath).then(setFileContent)
    }
  }

  const handleBack = () => {
    const parts = currentPath.split('/')
    parts.pop()
    setCurrentPath(parts.join('/'))
    setSelectedFile(null)
  }

  const handleSave = async () => {
    if (!selectedFile) return
    setSaving(true)
    try {
      await api.servers.files.put(serverId, selectedFile, fileContent)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            <span className="font-medium">/{currentPath || ''}</span>
          </div>
        </CardHeader>
        <CardContent>
          {currentPath && (
            <div
              className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer"
              onClick={handleBack}
            >
              <Folder className="h-4 w-4" />
              <span>..</span>
            </div>
          )}
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            files?.map((entry) => (
              <div
                key={entry.name}
                className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer"
                onClick={() => handleNavigate(entry)}
              >
                {entry.isDir ? <Folder className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                <span>{entry.name}</span>
                {!entry.isDir && <span className="text-xs text-muted-foreground ml-auto">{formatBytes(entry.size)}</span>}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {selectedFile && (
        <Card>
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">{selectedFile}</span>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span className="ml-1">Save</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              className="font-mono text-sm h-80"
              value={fileContent}
              onChange={(e) => setFileContent(e.target.value)}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ServerDetailPage() {
  const { serverId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: server, isLoading, error } = useQuery({
    queryKey: ['server', serverId],
    queryFn: () => api.servers.get(serverId),
    refetchInterval: 5000,
  })

  const { data: pack } = useQuery({
    queryKey: ['pack', server?.packId],
    queryFn: () => api.packs.get(server!.packId),
    enabled: !!server?.packId,
  })

  const startMutation = useMutation({
    mutationFn: () => api.servers.start(serverId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['server', serverId] }),
  })

  const stopMutation = useMutation({
    mutationFn: () => api.servers.stop(serverId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['server', serverId] }),
  })

  const restartMutation = useMutation({
    mutationFn: () => api.servers.restart(serverId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['server', serverId] }),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.servers.delete(serverId),
    onSuccess: () => navigate({ to: '/' }),
  })

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error || !server) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load server: {error?.message || 'Not found'}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isRunning = server.state === 'running'
  const isStopped = server.state === 'stopped'
  const isLoading2 = startMutation.isPending || stopMutation.isPending || restartMutation.isPending

  return (
    <div className="container mx-auto p-6">
      <Button variant="ghost" className="mb-4" onClick={() => navigate({ to: '/' })}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{server.name}</CardTitle>
              <CardDescription>{server.packId}</CardDescription>
            </div>
            <Badge variant={getStateBadgeVariant(server.state)} className="text-lg px-4 py-1">
              {server.state}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {server.ports.map((port) => (
              <div key={port.name} className="text-sm">
                <div className="font-medium">{port.name}</div>
                <div className="text-muted-foreground">{port.hostPort}/{port.protocol}</div>
              </div>
            ))}
            {server.stats && isRunning && (
              <>
                <div className="text-sm">
                  <div className="font-medium">CPU</div>
                  <div className="text-muted-foreground">{server.stats.cpuPercent.toFixed(1)}%</div>
                </div>
                <div className="text-sm">
                  <div className="font-medium">Memory</div>
                  <div className="text-muted-foreground">{formatBytes(server.stats.memoryUsage)}</div>
                </div>
              </>
            )}
          </div>
          <div className="flex gap-2">
            {isStopped && (
              <Button onClick={() => startMutation.mutate()} disabled={isLoading2}>
                {startMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                Start
              </Button>
            )}
            {isRunning && (
              <>
                <Button variant="outline" onClick={() => stopMutation.mutate()} disabled={isLoading2}>
                  {stopMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Square className="h-4 w-4 mr-2" />}
                  Stop
                </Button>
                <Button variant="outline" onClick={() => restartMutation.mutate()} disabled={isLoading2}>
                  {restartMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCw className="h-4 w-4 mr-2" />}
                  Restart
                </Button>
              </>
            )}
            <Button
              variant="destructive"
              onClick={() => { if (confirm('Delete this server?')) deleteMutation.mutate() }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="logs">
        <TabsList>
          <TabsTrigger value="logs">
            <Terminal className="h-4 w-4 mr-2" />Logs
          </TabsTrigger>
          <TabsTrigger value="console">
            <TerminalSquare className="h-4 w-4 mr-2" />Console
          </TabsTrigger>
          <TabsTrigger value="files">
            <FolderOpen className="h-4 w-4 mr-2" />Files
          </TabsTrigger>
        </TabsList>
        <TabsContent value="logs" className="mt-4">
          <LogsTab serverId={serverId} containerID={server.dockerContainerId} />
        </TabsContent>
        <TabsContent value="console" className="mt-4">
          <ConsoleTab
            serverId={serverId}
            serverState={server.state}
            rconEnabled={pack?.rcon?.enabled ?? false}
            isInstalled={!!server.dockerContainerId}
          />
        </TabsContent>
        <TabsContent value="files" className="mt-4">
          <FilesTab serverId={serverId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
