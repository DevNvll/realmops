import { useState, useEffect, useRef } from 'react'
import { Button } from '../ui/button'
import { ConnectionStatusBadge } from '../connection-status'
import { Terminal, RefreshCw } from 'lucide-react'

interface LogsTabProps {
  serverId: string
  containerID?: string
}

export function LogsTab({ serverId, containerID }: LogsTabProps) {
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
        <ConnectionStatusBadge status={connectionError ? 'disconnected' : 'connected'} />
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
