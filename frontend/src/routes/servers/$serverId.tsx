import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { ServerState, FileEntry } from '../../lib/api'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '../../components/ui/tabs'
import { ScrollArea } from '../../components/ui/scroll-area'
import Editor from '@monaco-editor/react'
import {
  Play,
  Square,
  RotateCw,
  Trash2,
  Loader2,
  Terminal,
  FolderOpen,
  FileText,
  Folder,
  Save,
  RefreshCw,
  TerminalSquare,
  Cpu,
  MemoryStick,
  Network,
  Box
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { ConsoleTab } from '../../components/server/ConsoleTab'

export const Route = createFileRoute('/servers/$serverId')({
  component: ServerDetailPage,
  staticData: {
    title: 'Server Details'
  }
})

function getStateColor(state: ServerState): string {
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

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function LogsTab({
  serverId,
  containerID
}: {
  serverId: string
  containerID?: string
}) {
  const [logs, setLogs] = useState<string[]>([])
  const [connectionError, setConnectionError] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const retryTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    if (!containerID) return

    const connect = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return

      const wsUrl = (
        import.meta.env.VITE_API_URL || 'http://localhost:8080/api'
      )
        .replace('http', 'ws')
        .replace('/api', '')
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
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs])

  if (!containerID) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Terminal className="h-8 w-8 mb-2 opacity-50" />
        <p>Server not installed yet.</p>
      </div>
    )
  }

  return (
    <div className="relative flex flex-col h-full min-h-0">
      {/* Floating action buttons */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-zinc-900/80 backdrop-blur-sm px-2 py-1 rounded text-xs">
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${connectionError ? 'bg-red-400' : 'bg-emerald-400'}`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${connectionError ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
          </span>
          <span className="text-zinc-400">{connectionError ? 'Disconnected' : 'Live'}</span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setLogs([])}
          className="h-7 text-xs bg-zinc-900/80 backdrop-blur-sm hover:bg-zinc-800"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Clear
        </Button>
      </div>
      {/* Full-screen log content */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 w-full bg-[#0a0a0a] p-4 pt-14 font-mono text-xs overflow-y-auto"
      >
        <div className="space-y-1">
          {logs.length === 0 ? (
            <span className="text-zinc-600 italic">Waiting for logs...</span>
          ) : (
            logs.map((log, i) => (
              <div
                key={i}
                className="whitespace-pre-wrap break-all text-zinc-300 border-l-2 border-transparent hover:border-emerald-500/50 hover:bg-emerald-500/5 pl-2 -ml-2 py-0.5 transition-colors"
              >
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const languageMap: Record<string, string> = {
    // Config files
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'ini',
    ini: 'ini',
    cfg: 'ini',
    conf: 'ini',
    properties: 'ini',
    // Programming
    js: 'javascript',
    ts: 'typescript',
    jsx: 'javascript',
    tsx: 'typescript',
    py: 'python',
    java: 'java',
    lua: 'lua',
    sh: 'shell',
    bash: 'shell',
    bat: 'bat',
    ps1: 'powershell',
    // Web
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    xml: 'xml',
    // Data
    sql: 'sql',
    md: 'markdown',
    txt: 'plaintext',
    log: 'plaintext'
  }
  return languageMap[ext] || 'plaintext'
}

function FilesTab({ serverId }: { serverId: string }) {
  const [currentPath, setCurrentPath] = useState('')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingFile, setLoadingFile] = useState(false)

  const { data: files, isLoading } = useQuery({
    queryKey: ['server-files', serverId, currentPath],
    queryFn: () => api.servers.files.list(serverId, currentPath)
  })

  const handleNavigate = async (entry: FileEntry) => {
    if (entry.isDir) {
      setCurrentPath(currentPath ? `${currentPath}/${entry.name}` : entry.name)
      setSelectedFile(null)
    } else {
      const filePath = currentPath ? `${currentPath}/${entry.name}` : entry.name
      setLoadingFile(true)
      setSelectedFile(filePath)
      try {
        const content = await api.servers.files.get(serverId, filePath)
        setFileContent(content)
      } finally {
        setLoadingFile(false)
      }
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      <div className="lg:col-span-1 flex flex-col h-full border-2 border-border bg-card">
        <div className="py-3 px-4 border-b-2 border-border bg-muted/30">
          <div className="flex items-center gap-2 text-sm font-bold overflow-hidden font-mono">
            <FolderOpen className="h-4 w-4 shrink-0" />
            <span className="truncate" title={`/${currentPath}`}>
              /{currentPath}
            </span>
          </div>
        </div>
        <div className="p-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-2 space-y-0.5">
              {currentPath && (
                <div
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded-none cursor-pointer text-sm transition-colors font-mono"
                  onClick={handleBack}
                >
                  <Folder className="h-4 w-4 text-blue-500 fill-blue-500/20" />
                  <span className="font-bold">..</span>
                </div>
              )}
              {isLoading ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                files?.map((entry) => (
                  <div
                    key={entry.name}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-none cursor-pointer text-sm transition-colors font-mono ${
                      selectedFile?.endsWith(entry.name)
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => handleNavigate(entry)}
                  >
                    {entry.isDir ? (
                      <Folder className="h-4 w-4 text-blue-500 fill-blue-500/20" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    <span className="truncate flex-1">{entry.name}</span>
                    {!entry.isDir && (
                      <span className="text-xs opacity-70 tabular-nums">
                        {formatBytes(entry.size)}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      <div className="lg:col-span-2 flex flex-col h-full border-2 border-border bg-card">
        {selectedFile ? (
          <>
            <div className="py-2 px-4 border-b-2 border-border bg-muted/30 min-h-[53px] flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="font-bold text-sm font-mono">
                  {selectedFile}
                </span>
              </div>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="h-8 shadow-none"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                )}
                SAVE
              </Button>
            </div>
            <div className="flex-1 min-h-0">
              {loadingFile ? (
                <div className="flex items-center justify-center h-full bg-[#1e1e1e]">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Editor
                  key={selectedFile}
                  height="100%"
                  language={getLanguageFromFilename(selectedFile)}
                  value={fileContent}
                  onChange={(value) => setFileContent(value || '')}
                  theme="vs-dark"
                  loading={
                    <div className="flex items-center justify-center h-full bg-[#1e1e1e]">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  }
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    automaticLayout: true,
                    tabSize: 2,
                    padding: { top: 12, bottom: 12 }
                  }}
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <FileText className="h-12 w-12 mb-4 opacity-20" />
            <p className="font-mono uppercase">Select a file to view or edit</p>
          </div>
        )}
      </div>
    </div>
  )
}

function ServerDetailPage() {
  const { serverId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

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
    return (
      <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !server) {
    return (
      <div className="container mx-auto p-8">
        <div className="border-2 border-destructive bg-destructive/5 p-6">
          <p className="text-destructive font-bold uppercase">
            Failed to load server: {error?.message || 'Not found'}
          </p>
        </div>
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
                    className={`${getStateColor(server.state)} border-2 rounded-none`}
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
                    <div className="flex items-center gap-1.5 bg-muted px-1.5 py-0.5 border border-border text-xs text-foreground">
                      <Network className="h-3 w-3" />
                      <span>:{server.ports[0].hostPort}</span>
                    </div>
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
          </div>
        </Tabs>
      </div>
    </div>
  )
}
