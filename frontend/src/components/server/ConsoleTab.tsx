import { useState, useEffect, useRef, useCallback } from 'react'
import { createConsoleWebSocket } from '../../lib/api'
import type { ServerState, ConsoleMessage, ConsoleResponse } from '../../lib/api'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
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
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
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
    <div className="relative flex flex-col h-full min-h-0">
      {/* Floating action buttons - only show when connected or has output */}
      {(connectionStatus !== 'disconnected' || output.length > 0) && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-zinc-900/80 backdrop-blur-sm px-2 py-1 rounded text-xs">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                connectionStatus === 'connected' ? 'bg-emerald-400' :
                connectionStatus === 'connecting' ? 'bg-amber-400' :
                connectionStatus === 'error' ? 'bg-red-400' : 'bg-zinc-400'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                connectionStatus === 'connected' ? 'bg-emerald-500' :
                connectionStatus === 'connecting' ? 'bg-amber-500' :
                connectionStatus === 'error' ? 'bg-red-500' : 'bg-zinc-500'
              }`}></span>
            </span>
            <span className="text-zinc-400 capitalize">{connectionStatus}</span>
          </div>
          {connectionStatus === 'connected' && (
            <Button size="sm" variant="secondary" onClick={disconnect} className="h-7 text-xs bg-zinc-900/80 backdrop-blur-sm hover:bg-zinc-800">
              Disconnect
            </Button>
          )}
          {connectionStatus === 'error' && (
            <Button size="sm" variant="secondary" onClick={connect} className="h-7 text-xs bg-zinc-900/80 backdrop-blur-sm hover:bg-zinc-800">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Retry
            </Button>
          )}
          {output.length > 0 && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setOutput([])}
              className="h-7 text-xs bg-zinc-900/80 backdrop-blur-sm hover:bg-zinc-800"
            >
              Clear
            </Button>
          )}
        </div>
      )}

      {/* Console Output - fills remaining space */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 w-full bg-[#0a0a0a] p-4 pt-14 font-mono text-xs overflow-y-auto"
      >
        {output.length === 0 && connectionStatus === 'disconnected' ? (
          <div className="flex flex-col items-center justify-center h-full -mt-14">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="h-16 w-16 rounded-full bg-zinc-800/50 flex items-center justify-center">
                <Send className="h-7 w-7 text-zinc-600" />
              </div>
              <div className="space-y-1">
                <p className="text-zinc-400 text-sm font-sans">RCON Console</p>
                <p className="text-zinc-600 text-xs font-sans">Connect to send commands to your server</p>
              </div>
              <Button onClick={connect} className="mt-2 bg-emerald-600 hover:bg-emerald-700">
                <Send className="h-4 w-4 mr-2" />
                Connect to Console
              </Button>
            </div>
          </div>
        ) : output.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full -mt-14">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="h-12 w-12 rounded-full bg-zinc-800/50 flex items-center justify-center animate-pulse">
                <RefreshCw className="h-5 w-5 text-amber-500 animate-spin" />
              </div>
              <p className="text-zinc-500 text-sm font-sans">Connecting...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {output.map((entry, i) => (
              <div key={i} className={`py-0.5 ${getEntryClassName(entry.type)}`}>
                {entry.content}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input - always at bottom */}
      <div className="flex gap-0 shrink-0 border-t border-zinc-800 bg-[#0a0a0a]">
        <div className="flex items-center px-4 text-emerald-500 font-mono text-sm font-bold">
          &gt;
        </div>
        <Input
          ref={inputRef}
          value={currentInput}
          onChange={(e) => setCurrentInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={connectionStatus === 'connected' ? 'Enter command...' : 'Connect to enter commands...'}
          disabled={connectionStatus !== 'connected'}
          className="font-mono border-0 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-12 text-sm text-zinc-200 placeholder:text-zinc-600"
        />
        <Button
          onClick={sendCommand}
          disabled={connectionStatus !== 'connected' || !currentInput.trim()}
          className="rounded-none h-12 px-6 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-800 disabled:text-zinc-600"
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
