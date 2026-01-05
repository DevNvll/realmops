import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Server, VariableConfig } from '../../lib/api'
import { api } from '../../lib/api'
import { Button } from '../ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../ui/dialog'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../ui/select'

interface EditServerDialogProps {
  server: Server
  open: boolean
  onOpenChange: (open: boolean) => void
}

function VariableInput({
  variable,
  value,
  onChange,
}: {
  variable: VariableConfig
  value: unknown
  onChange: (value: unknown) => void
}) {
  if (variable.type === 'select' && variable.options) {
    return (
      <Select value={String(value || '')} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={`Select ${variable.label}`} />
        </SelectTrigger>
        <SelectContent>
          {variable.options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (variable.type === 'boolean') {
    return (
      <Select
        value={String(value || 'false')}
        onValueChange={(v) => onChange(v === 'true')}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">Yes</SelectItem>
          <SelectItem value="false">No</SelectItem>
        </SelectContent>
      </Select>
    )
  }

  if (variable.type === 'number') {
    return (
      <Input
        type="number"
        value={String(value || '')}
        onChange={(e) => onChange(Number(e.target.value))}
        min={variable.min}
        max={variable.max}
        className="w-full"
      />
    )
  }

  return (
    <Input
      type="text"
      value={String(value || '')}
      onChange={(e) => onChange(e.target.value)}
      className="w-full"
    />
  )
}

export function EditServerDialog({ server, open, onOpenChange }: EditServerDialogProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(server.name)
  const [variables, setVariables] = useState<Record<string, unknown>>(server.vars || {})

  const { data: pack } = useQuery({
    queryKey: ['pack', server.packId],
    queryFn: () => api.packs.get(server.packId),
    enabled: open,
  })

  // Reset form when dialog opens or server changes
  useEffect(() => {
    if (open) {
      setName(server.name)
      setVariables(server.vars || {})
    }
  }, [open, server])

  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; variables?: Record<string, unknown> }) =>
      api.servers.update(server.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['server', server.id] })
      queryClient.invalidateQueries({ queryKey: ['servers'] })
      onOpenChange(false)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const updates: { name?: string; variables?: Record<string, unknown> } = {}

    // Only include name if it changed
    if (name !== server.name) {
      updates.name = name
    }

    // Only include variables if they changed
    const varsChanged = JSON.stringify(variables) !== JSON.stringify(server.vars)
    if (varsChanged) {
      updates.variables = variables
    }

    // Only make request if something changed
    if (Object.keys(updates).length > 0) {
      updateMutation.mutate(updates)
    } else {
      onOpenChange(false)
    }
  }

  const isInstalling = server.state === 'installing'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold uppercase">Edit Server</DialogTitle>
            <DialogDescription>
              Update server settings. Changes to variables will take effect on next server restart.
            </DialogDescription>
          </DialogHeader>

          {isInstalling && (
            <div className="flex items-center gap-2 p-3 mt-4 bg-amber-500/10 border border-amber-500/20 text-amber-600 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Cannot edit server while it is installing.</span>
            </div>
          )}

          <div className="space-y-6 py-6">
            {/* Server Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs font-bold uppercase text-muted-foreground">
                Server Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. My Survival World"
                disabled={isInstalling}
                required
              />
            </div>

            {/* Variables */}
            {pack && pack.variables.length > 0 && (
              <div className="space-y-4">
                <div className="border-t pt-4">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">
                    Configuration Variables
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Changes will apply on next server restart.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {pack.variables.map((variable) => (
                    <div key={variable.name} className="space-y-2">
                      <Label
                        htmlFor={variable.name}
                        className="flex items-center gap-1 text-xs font-medium"
                      >
                        {variable.label}
                        {variable.required && (
                          <span className="text-destructive">*</span>
                        )}
                      </Label>
                      <VariableInput
                        variable={variable}
                        value={variables[variable.name] ?? variable.default}
                        onChange={(value) =>
                          setVariables((v) => ({ ...v, [variable.name]: value }))
                        }
                      />
                      {variable.description && (
                        <p className="text-xs text-muted-foreground">
                          {variable.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isInstalling || updateMutation.isPending || !name.trim()}
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>

          {updateMutation.error && (
            <div className="mt-4 p-3 bg-destructive/10 text-destructive text-sm">
              {updateMutation.error.message}
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
