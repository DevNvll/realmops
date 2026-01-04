import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Loader2, AlertTriangle, Check } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

export const Route = createFileRoute('/settings/server')({
  component: ServerSettingsPage,
  staticData: {
    title: 'Server Settings'
  }
})

function ServerSettingsPage() {
  const { data: config, isLoading } = useQuery({
    queryKey: ['system-config'],
    queryFn: api.system.config,
    refetchInterval: 5000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {config?.pendingRestart && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Restart Required</AlertTitle>
          <AlertDescription>
            Configuration changes have been saved but require a server restart to take effect.
          </AlertDescription>
        </Alert>
      )}

      <SFTPConfigCard config={config} />
      <PortRangeCard config={config} />
      <DockerConfigCard config={config} />
      <SystemPathsCard config={config} />
    </div>
  )
}

function SFTPConfigCard({ config }: { config: ReturnType<typeof api.system.config> extends Promise<infer T> ? T | undefined : never }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [sftpEnabled, setSftpEnabled] = useState(config?.running.sftpEnabled ?? true)
  const [sftpPort, setSftpPort] = useState(String(config?.running.sftpPort ?? 2022))
  const [isSuccess, setIsSuccess] = useState(false)

  useEffect(() => {
    if (config) {
      setSftpEnabled(config.running.sftpEnabled)
      setSftpPort(String(config.running.sftpPort))
    }
  }, [config])

  const mutation = useMutation({
    mutationFn: api.system.updateConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-config'] })
      queryClient.invalidateQueries({ queryKey: ['sftp-status'] })
      setIsSuccess(true)
      toast({
        title: 'SFTP settings saved',
        description: 'Changes will take effect after restart.',
      })
      setTimeout(() => setIsSuccess(false), 2000)
    },
    onError: (error) => {
      toast({
        title: 'Failed to save',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    },
  })

  const handleSave = () => {
    const port = parseInt(sftpPort, 10)
    if (isNaN(port) || port < 1024 || port > 65535) {
      toast({
        title: 'Invalid port',
        description: 'Port must be between 1024 and 65535',
        variant: 'destructive',
      })
      return
    }

    mutation.mutate({
      sftpEnabled,
      sftpPort: port,
    })
  }

  const hasChanges = config && (
    sftpEnabled !== config.running.sftpEnabled ||
    parseInt(sftpPort, 10) !== config.running.sftpPort
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">SFTP Configuration</CardTitle>
        <CardDescription>
          Configure the built-in SFTP server for file transfers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="sftp-enabled" className="text-base font-medium">
              SFTP Server
            </Label>
            <p className="text-sm text-muted-foreground">
              Enable or disable the SFTP server
            </p>
          </div>
          <Switch
            id="sftp-enabled"
            checked={sftpEnabled}
            onCheckedChange={setSftpEnabled}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sftp-port">Port</Label>
          <Input
            id="sftp-port"
            type="number"
            value={sftpPort}
            onChange={(e) => setSftpPort(e.target.value)}
            min={1024}
            max={65535}
            className="max-w-[200px]"
          />
          <p className="text-sm text-muted-foreground">
            The port the SFTP server listens on (1024-65535)
          </p>
        </div>
        {config?.running && (
          <div className="flex items-center gap-2 text-sm rounded-lg bg-muted/50 p-3">
            <span
              className={`h-2 w-2 rounded-full ${
                config.running.sftpEnabled ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-muted-foreground">
              Currently {config.running.sftpEnabled ? 'running' : 'stopped'} on port {config.running.sftpPort}
            </span>
          </div>
        )}
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSave}
            disabled={mutation.isPending || !hasChanges}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isSuccess && <Check className="h-4 w-4 mr-2" />}
            {isSuccess ? 'Saved' : 'Save Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function PortRangeCard({ config }: { config: ReturnType<typeof api.system.config> extends Promise<infer T> ? T | undefined : never }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [portStart, setPortStart] = useState(String(config?.running.portRangeStart ?? 20000))
  const [portEnd, setPortEnd] = useState(String(config?.running.portRangeEnd ?? 40000))
  const [isSuccess, setIsSuccess] = useState(false)

  useEffect(() => {
    if (config) {
      setPortStart(String(config.running.portRangeStart))
      setPortEnd(String(config.running.portRangeEnd))
    }
  }, [config])

  const mutation = useMutation({
    mutationFn: api.system.updateConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-config'] })
      setIsSuccess(true)
      toast({
        title: 'Port range saved',
        description: 'Changes will take effect after restart.',
      })
      setTimeout(() => setIsSuccess(false), 2000)
    },
    onError: (error) => {
      toast({
        title: 'Failed to save',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    },
  })

  const handleSave = () => {
    const start = parseInt(portStart, 10)
    const end = parseInt(portEnd, 10)

    if (isNaN(start) || isNaN(end) || start < 1024 || end > 65535 || start >= end) {
      toast({
        title: 'Invalid port range',
        description: 'Start must be less than end, both between 1024 and 65535',
        variant: 'destructive',
      })
      return
    }

    mutation.mutate({
      portRangeStart: start,
      portRangeEnd: end,
    })
  }

  const hasChanges = config && (
    parseInt(portStart, 10) !== config.running.portRangeStart ||
    parseInt(portEnd, 10) !== config.running.portRangeEnd
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Port Allocation</CardTitle>
        <CardDescription>
          Configure the port range for game server allocation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="port-start">Start Port</Label>
            <Input
              id="port-start"
              type="number"
              value={portStart}
              onChange={(e) => setPortStart(e.target.value)}
              min={1024}
              max={65535}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="port-end">End Port</Label>
            <Input
              id="port-end"
              type="number"
              value={portEnd}
              onChange={(e) => setPortEnd(e.target.value)}
              min={1024}
              max={65535}
            />
          </div>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-sm text-muted-foreground">
            Game servers will be allocated ports within this range. Current range: {config?.running.portRangeStart} - {config?.running.portRangeEnd}
          </p>
        </div>
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSave}
            disabled={mutation.isPending || !hasChanges}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isSuccess && <Check className="h-4 w-4 mr-2" />}
            {isSuccess ? 'Saved' : 'Save Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function DockerConfigCard({ config }: { config: ReturnType<typeof api.system.config> extends Promise<infer T> ? T | undefined : never }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [dockerHost, setDockerHost] = useState(config?.running.dockerHost ?? '')
  const [isSuccess, setIsSuccess] = useState(false)

  useEffect(() => {
    if (config) {
      setDockerHost(config.running.dockerHost)
    }
  }, [config])

  const mutation = useMutation({
    mutationFn: api.system.updateConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-config'] })
      setIsSuccess(true)
      toast({
        title: 'Docker settings saved',
        description: 'Changes will take effect after restart.',
      })
      setTimeout(() => setIsSuccess(false), 2000)
    },
    onError: (error) => {
      toast({
        title: 'Failed to save',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    },
  })

  const handleSave = () => {
    if (!dockerHost.trim()) {
      toast({
        title: 'Invalid Docker host',
        description: 'Docker host cannot be empty',
        variant: 'destructive',
      })
      return
    }

    mutation.mutate({
      dockerHost: dockerHost.trim(),
    })
  }

  const hasChanges = config && dockerHost.trim() !== config.running.dockerHost

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Docker Configuration</CardTitle>
        <CardDescription>
          Configure the Docker daemon connection.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-2">
          <Label htmlFor="docker-host">Docker Host</Label>
          <Input
            id="docker-host"
            value={dockerHost}
            onChange={(e) => setDockerHost(e.target.value)}
            placeholder="unix:///var/run/docker.sock"
          />
          <p className="text-sm text-muted-foreground">
            Examples: unix:///var/run/docker.sock (Linux), npipe:////./pipe/docker_engine (Windows)
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
          <span
            className={`h-2 w-2 rounded-full ${
              config?.dockerConnected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className={`text-sm ${config?.dockerConnected ? 'text-green-600' : 'text-red-600'}`}>
            {config?.dockerConnected ? 'Connected to Docker' : 'Disconnected from Docker'}
          </span>
        </div>
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSave}
            disabled={mutation.isPending || !hasChanges}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isSuccess && <Check className="h-4 w-4 mr-2" />}
            {isSuccess ? 'Saved' : 'Save Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function SystemPathsCard({ config }: { config: ReturnType<typeof api.system.config> extends Promise<infer T> ? T | undefined : never }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">System Paths</CardTitle>
        <CardDescription>
          Read-only system configuration paths.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid gap-1.5">
            <Label className="text-muted-foreground">Data Directory</Label>
            <code className="text-sm bg-muted px-3 py-2 rounded-md block overflow-x-auto">
              {config?.running.dataDir || '-'}
            </code>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-muted-foreground">Database Path</Label>
            <code className="text-sm bg-muted px-3 py-2 rounded-md block overflow-x-auto">
              {config?.running.databasePath || '-'}
            </code>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-muted-foreground">Packs Directory</Label>
            <code className="text-sm bg-muted px-3 py-2 rounded-md block overflow-x-auto">
              {config?.running.packsDir || '-'}
            </code>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
