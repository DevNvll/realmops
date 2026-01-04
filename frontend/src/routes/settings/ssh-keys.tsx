import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Plus,
  Trash2,
  Key,
  Copy,
  Check,
  Loader2,
  Clock,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export const Route = createFileRoute('/settings/ssh-keys')({
  component: SSHKeysPage,
  staticData: {
    title: 'SSH Keys'
  }
})

function SSHKeysPage() {
  const queryClient = useQueryClient()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyPublicKey, setNewKeyPublicKey] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const { data: keys, isLoading } = useQuery({
    queryKey: ['ssh-keys'],
    queryFn: api.sshKeys.list,
  })

  const createMutation = useMutation({
    mutationFn: api.sshKeys.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ssh-keys'] })
      setIsAddDialogOpen(false)
      setNewKeyName('')
      setNewKeyPublicKey('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: api.sshKeys.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ssh-keys'] })
    },
  })

  const handleAddKey = () => {
    if (!newKeyName.trim() || !newKeyPublicKey.trim()) return
    createMutation.mutate({
      name: newKeyName.trim(),
      publicKey: newKeyPublicKey.trim(),
    })
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">SSH Keys</CardTitle>
            <CardDescription>
              Manage SSH public keys for SFTP authentication. Add your public keys here to enable secure file access.
            </CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add SSH Key</DialogTitle>
                <DialogDescription>
                  Add a new SSH public key for SFTP authentication. Paste your public key (usually found in ~/.ssh/id_ed25519.pub or ~/.ssh/id_rsa.pub).
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="key-name">Name</Label>
                  <Input
                    id="key-name"
                    placeholder="My Laptop Key"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="public-key">Public Key</Label>
                  <Textarea
                    id="public-key"
                    placeholder="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI... user@host"
                    value={newKeyPublicKey}
                    onChange={(e) => setNewKeyPublicKey(e.target.value)}
                    className="font-mono text-xs min-h-[100px]"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddKey}
                  disabled={createMutation.isPending || !newKeyName.trim() || !newKeyPublicKey.trim()}
                >
                  {createMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Add Key
                </Button>
              </DialogFooter>
              {createMutation.isError && (
                <p className="text-sm text-red-500 mt-2">
                  {createMutation.error instanceof Error
                    ? createMutation.error.message
                    : 'Failed to add key'}
                </p>
              )}
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : keys && keys.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Fingerprint</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4 text-muted-foreground" />
                        {key.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {key.keyType}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-muted-foreground max-w-[200px] truncate">
                          {key.fingerprint}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(key.fingerprint, key.id)}
                        >
                          {copiedId === key.id ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDistanceToNow(new Date(key.createdAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {key.lastUsedAt ? (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(key.lastUsedAt), { addSuffix: true })}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/50">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete SSH Key</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{key.name}"? Servers using this key will no longer be accessible via SFTP with this key.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(key.id)}
                              className="bg-red-500 hover:bg-red-600"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Key className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="font-medium text-muted-foreground mb-1">No SSH keys</h3>
              <p className="text-sm text-muted-foreground/70 mb-4">
                Add your first SSH key to enable SFTP access to your servers.
              </p>
              <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Key
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SFTP Status Card */}
      <SFTPStatusCard />
    </div>
  )
}

function SFTPStatusCard() {
  const { data: status } = useQuery({
    queryKey: ['sftp-status'],
    queryFn: api.system.sftpStatus,
    refetchInterval: 10000,
  })

  if (!status) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">SFTP Server Status</CardTitle>
        <CardDescription>
          Current status of the SFTP server for file transfers.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Status</p>
            <p className="font-medium flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  status.running ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              {status.running ? 'Running' : 'Stopped'}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Port</p>
            <p className="font-medium font-mono">{status.port}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Active Sessions</p>
            <p className="font-medium">{status.activeSessions ?? 0}</p>
          </div>
        </div>
        {status.hostFingerprint && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-1">Host Fingerprint</p>
            <code className="text-xs font-mono bg-muted px-2 py-1 rounded block break-all">
              {status.hostFingerprint}
            </code>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
