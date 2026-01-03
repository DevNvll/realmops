import { useState, useEffect, useRef, useCallback } from 'react'
import { createConsoleWebSocket } from '../../lib/api'
import type { ServerState, ConsoleMessage, ConsoleResponse } from '../../lib/api'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import { ScrollArea } from '../ui/scroll-area'
import { RefreshCw, Send } from 'lucide-react'

interface ConsoleEntry {
  type: 'command' | 'response' | 'error' | 'status'
  content: string
  time: string
}

interface ConsoleTabProps {
  serverId: string
  serverState: ServerState
  rconEnabled: boolean | undefined
  isInstalled: boolean
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export function ConsoleTab({ serverId, serverState, rconEnabled, isInstalled }: ConsoleTabProps) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [output, setOutput] = useState<ConsoleEntry[]>([])
  const [currentInput, setCurrentInput] = useState('')
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  const wsRef = useRef<WebSocket | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const addEntry = useCallback((entry: ConsoleEntry) => {
    setOutput((prev) => [...prev.slice(-200), entry])
  }, [])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    if (serverState !== 'running') return

    setConnectionStatus('connecting')

    const ws = createConsoleWebSocket(serverId)
    wsRef.current = ws

    ws.onopen = () => {
      addEntry({
        type: 'status',
        content: 'WebSocket connected, authenticating with RCON...',
        time: new Date().toISOString(),
      })
    }

    ws.onmessage = (event) => {
      try {
        const response: ConsoleResponse = JSON.parse(event.data)

        if (response.type === 'status') {
          if (response.payload === 'connected') {
            setConnectionStatus('connected')
          } else if (response.payload === 'connecting') {
            setConnectionStatus('connecting')
          } else if (response.payload === 'reconnected') {
            setConnectionStatus('connected')
          }
          addEntry({
            type: 'status',
            content: response.payload,
            time: response.time,
          })
        } else if (response.type === 'error') {
          addEntry({
            type: 'error',
            content: response.payload,
            time: response.time,
          })
        } else if (response.type === 'response') {
          addEntry({
            type: 'response',
            content: response.payload || '(no output)',
            time: response.time,
          })
        }
      } catch {
        addEntry({
          type: 'error',
          content: 'Failed to parse response',
          time: new Date().toISOString(),
        })
      }
    }

    ws.onerror = () => {
      setConnectionStatus('error')
    }

    ws.onclose = () => {
      // Only show disconnected if we were previously connected
      if (connectionStatus === 'connected') {
        addEntry({
          type: 'status',
          content: 'Disconnected',
          time: new Date().toISOString(),
        })
      }
      setConnectionStatus('disconnected')
    }
  }, [serverId, serverState, addEntry, connectionStatus])

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setConnectionStatus('disconnected')
  }, [])

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  useEffect(() => {
    if (serverState !== 'running' && wsRef.current) {
      disconnect()
    }
  }, [serverState, disconnect])


  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [output])

  const sendCommand = useCallback(() => {
    if (!currentInput.trim()) return
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

    const message: ConsoleMessage = {
      type: 'command',
      payload: currentInput.trim(),
    }

    addEntry({
      type: 'command',
      content: `> ${currentInput.trim()}`,
      time: new Date().toISOString(),
    })

    wsRef.current.send(JSON.stringify(message))

    setCommandHistory((prev) => [...prev.slice(-50), currentInput.trim()])
    setHistoryIndex(-1)
    setCurrentInput('')
  }, [currentInput, addEntry])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      sendCommand()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (commandHistory.length > 0) {
        const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex
        setHistoryIndex(newIndex)
        setCurrentInput(commandHistory[commandHistory.length - 1 - newIndex] || '')
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        setCurrentInput(commandHistory[commandHistory.length - 1 - newIndex] || '')
      } else if (historyIndex === 0) {
        setHistoryIndex(-1)
        setCurrentInput('')
      }
    }
  }

  const getStatusBadgeVariant = (): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (connectionStatus) {
      case 'connected':
        return 'default'
      case 'connecting':
        return 'secondary'
      case 'error':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  if (rconEnabled === undefined) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading console configuration...
      </div>
    )
  }

  if (!rconEnabled) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        RCON is not enabled for this server type.
      </div>
    )
  }

  if (!isInstalled) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Server is not installed yet. Please wait for installation to complete.
      </div>
    )
  }

  if (serverState !== 'running') {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Server must be running to use the console. Start the server to connect.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant={getStatusBadgeVariant()}>{connectionStatus}</Badge>
        {connectionStatus === 'disconnected' && (
          <Button size="sm" variant="outline" onClick={connect}>
            Connect
          </Button>
        )}
        {connectionStatus === 'connected' && (
          <Button size="sm" variant="outline" onClick={disconnect}>
            Disconnect
          </Button>
        )}
        {connectionStatus === 'error' && (
          <Button size="sm" variant="outline" onClick={connect}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setOutput([])}
          className="ml-auto"
        >
          Clear
        </Button>
      </div>

      <ScrollArea ref={scrollRef} className="h-80 w-full rounded border bg-black p-4">
        <pre className="text-xs font-mono whitespace-pre-wrap">
          {output.length === 0 ? (
            <span className="text-muted-foreground">
              {connectionStatus === 'disconnected'
                ? 'Click "Connect" to start the console session.'
                : 'Waiting for connection...'}
            </span>
          ) : (
            output.map((entry, i) => (
              <div key={i} className={getEntryClassName(entry.type)}>
                {entry.content}
              </div>
            ))
          )}
        </pre>
      </ScrollArea>

      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={currentInput}
          onChange={(e) => setCurrentInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter command..."
          disabled={connectionStatus !== 'connected'}
          className="font-mono"
        />
        <Button
          onClick={sendCommand}
          disabled={connectionStatus !== 'connected' || !currentInput.trim()}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function getEntryClassName(type: ConsoleEntry['type']): string {
  switch (type) {
    case 'command':
      return 'text-cyan-400'
    case 'response':
      return 'text-green-400'
    case 'error':
      return 'text-red-400'
    case 'status':
      return 'text-yellow-400'
    default:
      return 'text-gray-400'
  }
}
