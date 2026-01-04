import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Key,
  Copy,
  Check,
  Loader2,
  RefreshCw,
  Terminal,
  Lock,
  Unlock,
  ExternalLink,
} from 'lucide-react'
import { Link } from '@tanstack/react-router'

interface SFTPTabProps {
  serverId: string
}

export function SFTPTab({ serverId }: SFTPTabProps) {
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState<string | null>(null)
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)

  const { data: sftpConfig, isLoading: configLoading } = useQuery({
    queryKey: ['sftp-config', serverId],
    queryFn: () => api.sftp.get(serverId),
  })

  const { data: sshKeys } = useQuery({
    queryKey: ['ssh-keys'],
    queryFn: api.sshKeys.list,
  })

  const updateMutation = useMutation({
    mutationFn: (data: { enabled?: boolean; sshKeyId?: string }) =>
      api.sftp.update(serverId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sftp-config', serverId] })
    },
  })

  const generatePasswordMutation = useMutation({
    mutationFn: () => api.sftp.generatePassword(serverId),
    onSuccess: (data) => {
      setGeneratedPassword(data.password)
      setShowPasswordDialog(true)
      queryClient.invalidateQueries({ queryKey: ['sftp-config', serverId] })
    },
  })

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  if (configLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!sftpConfig) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Failed to load SFTP configuration</p>
      </div>
    )
  }

  const connectionString = `sftp://${sftpConfig.connectionInfo.username}@${sftpConfig.connectionInfo.host}:${sftpConfig.connectionInfo.port}`

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Connection Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Connection Details
          </CardTitle>
          <CardDescription>
            Use these details to connect via SFTP clients like FileZilla or WinSCP.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Host</Label>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono bg-muted px-2 py-1 rounded flex-1">
                  {sftpConfig.connectionInfo.host}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => copyToClipboard(sftpConfig.connectionInfo.host, 'host')}
                >
                  {copied === 'host' ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Port</Label>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono bg-muted px-2 py-1 rounded flex-1">
                  {sftpConfig.connectionInfo.port}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => copyToClipboard(String(sftpConfig.connectionInfo.port), 'port')}
                >
                  {copied === 'port' ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Username</Label>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono bg-muted px-2 py-1 rounded flex-1 truncate">
                  {sftpConfig.connectionInfo.username}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => copyToClipboard(sftpConfig.connectionInfo.username, 'username')}
                >
                  {copied === 'username' ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t">
            <Label className="text-xs text-muted-foreground">Connection URL</Label>
            <div className="flex items-center gap-2 mt-1">
              <code className="text-xs font-mono bg-muted px-2 py-1.5 rounded flex-1 truncate">
                {connectionString}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => copyToClipboard(connectionString, 'url')}
              >
                {copied === 'url' ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Authentication Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Key className="h-5 w-5" />
            Authentication
          </CardTitle>
          <CardDescription>
            Configure SSH key or password authentication for this server.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable SFTP */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>SFTP Access</Label>
              <p className="text-sm text-muted-foreground">
                Enable or disable SFTP access for this server
              </p>
            </div>
            <Switch
              checked={sftpConfig.enabled}
              onCheckedChange={(enabled) => updateMutation.mutate({ enabled })}
              disabled={updateMutation.isPending}
            />
          </div>

          {/* SSH Key Selection */}
          <div className="space-y-2">
            <Label>SSH Key</Label>
            <div className="flex items-center gap-2">
              <Select
                value={sftpConfig.sshKeyId || 'none'}
                onValueChange={(value) =>
                  updateMutation.mutate({ sshKeyId: value === 'none' ? '' : value })
                }
                disabled={updateMutation.isPending}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select an SSH key" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">No SSH key (password only)</span>
                  </SelectItem>
                  {sshKeys?.map((key) => (
                    <SelectItem key={key.id} value={key.id}>
                      <div className="flex items-center gap-2">
                        <Key className="h-3.5 w-3.5" />
                        {key.name}
                        <span className="text-xs text-muted-foreground">
                          ({key.keyType})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" asChild>
                <Link to="/settings/ssh-keys">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Manage Keys
                </Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Select an SSH key for public key authentication, or use password-only access.
            </p>
          </div>

          {/* Password Section */}
          <div className="space-y-2 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  {sftpConfig.hasPassword ? (
                    <Lock className="h-4 w-4 text-green-500" />
                  ) : (
                    <Unlock className="h-4 w-4 text-muted-foreground" />
                  )}
                  Password Authentication
                </Label>
                <p className="text-sm text-muted-foreground">
                  {sftpConfig.hasPassword
                    ? 'Password is set. You can regenerate it if needed.'
                    : 'No password set. Generate one for password-based access.'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => generatePasswordMutation.mutate()}
                disabled={generatePasswordMutation.isPending}
              >
                {generatePasswordMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                {sftpConfig.hasPassword ? 'Regenerate' : 'Generate'} Password
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generated Password Dialog */}
      <AlertDialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>New SFTP Password Generated</AlertDialogTitle>
            <AlertDialogDescription>
              This password will only be shown once. Please copy it now and store it securely.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted px-3 py-2 rounded font-mono text-sm break-all">
                {generatedPassword}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(generatedPassword || '', 'password')}
              >
                {copied === 'password' ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowPasswordDialog(false)}>
              I've copied the password
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
