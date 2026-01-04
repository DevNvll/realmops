import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Trash2 } from "lucide-react"
import { HelpTooltip } from "@/components/help-tooltip"
import type {
  PortConfig,
  VariableConfig,
  InstallConfig,
  HealthConfig,
  ShutdownConfig,
  RCONConfig,
  ModsConfig,
  ModTarget,
  TemplateConfig,
  EnvVarConfig,
} from "@/lib/api/types"

// Default values
export const defaultPort: PortConfig = {
  name: "",
  containerPort: 25565,
  protocol: "tcp",
  hostPortMode: "auto",
  description: "",
}

export const defaultVariable: VariableConfig = {
  name: "",
  label: "",
  description: "",
  type: "string",
  default: "",
  required: false,
}

export const defaultInstall: InstallConfig = {
  method: "none",
}

export const defaultHealth: HealthConfig = {
  type: "process",
  gracePeriod: 30,
  interval: 10,
  timeout: 5,
  retries: 3,
}

export const defaultShutdown: ShutdownConfig = {
  signal: "SIGTERM",
  timeout: 30,
}

export const defaultRCON: RCONConfig = {
  enabled: false,
  portName: "",
  passwordVariable: "",
}

export const defaultMods: ModsConfig = {
  enabled: false,
  targets: [],
  applyWhileRunning: false,
}

export const defaultModTarget: ModTarget = {
  name: "",
  path: "",
  behavior: "merge",
}

export const defaultTemplate: TemplateConfig = {
  source: "",
  destination: "",
}

export const defaultEnvVar: EnvVarConfig = {
  name: "",
  value: "",
  template: false,
}

// Form state type
export type PackFormState = {
  packId: string
  packName: string
  packVersion: string
  packDescription: string
  dockerImage: string
  mountPath: string
  startCommand: string
  ports: PortConfig[]
  variables: VariableConfig[]
  workdir: string
  user: string
  entrypoint: string
  runtimeEnv: Record<string, string>
  install: InstallConfig
  health: HealthConfig
  shutdown: ShutdownConfig
  rcon: RCONConfig
  templates: TemplateConfig[]
  envVars: EnvVarConfig[]
  mods: ModsConfig
}

interface PackFormProps {
  state: PackFormState
  onChange: (updates: Partial<PackFormState>) => void
  initialized?: boolean
  isEditMode?: boolean
}

export function PackForm({ state, onChange, initialized = true, isEditMode = false }: PackFormProps) {
  // Helper state for new env key/value inputs
  const [newEnvKey, setNewEnvKey] = React.useState("")
  const [newEnvValue, setNewEnvValue] = React.useState("")

  // Port management
  const addPort = () => onChange({ ports: [...state.ports, { ...defaultPort }] })
  const removePort = (index: number) => {
    if (state.ports.length > 1) {
      onChange({ ports: state.ports.filter((_, i) => i !== index) })
    }
  }
  const updatePort = (index: number, field: keyof PortConfig, value: string | number) => {
    const updated = [...state.ports]
    updated[index] = { ...updated[index], [field]: value }
    onChange({ ports: updated })
  }

  // Variable management
  const addVariable = () => onChange({ variables: [...state.variables, { ...defaultVariable }] })
  const removeVariable = (index: number) => {
    onChange({ variables: state.variables.filter((_, i) => i !== index) })
  }
  const updateVariable = (index: number, field: keyof VariableConfig, value: unknown) => {
    const updated = [...state.variables]
    updated[index] = { ...updated[index], [field]: value }
    onChange({ variables: updated })
  }

  // Runtime env management
  const addRuntimeEnv = () => {
    if (newEnvKey && !state.runtimeEnv[newEnvKey]) {
      onChange({ runtimeEnv: { ...state.runtimeEnv, [newEnvKey]: newEnvValue } })
      setNewEnvKey("")
      setNewEnvValue("")
    }
  }
  const removeRuntimeEnv = (key: string) => {
    const updated = { ...state.runtimeEnv }
    delete updated[key]
    onChange({ runtimeEnv: updated })
  }

  // Template management
  const addTemplate = () => onChange({ templates: [...state.templates, { ...defaultTemplate }] })
  const removeTemplate = (index: number) => {
    onChange({ templates: state.templates.filter((_, i) => i !== index) })
  }
  const updateTemplate = (index: number, field: keyof TemplateConfig, value: string) => {
    const updated = [...state.templates]
    updated[index] = { ...updated[index], [field]: value }
    onChange({ templates: updated })
  }

  // EnvVar management
  const addEnvVar = () => onChange({ envVars: [...state.envVars, { ...defaultEnvVar }] })
  const removeEnvVar = (index: number) => {
    onChange({ envVars: state.envVars.filter((_, i) => i !== index) })
  }
  const updateEnvVar = (index: number, field: keyof EnvVarConfig, value: string | boolean) => {
    const updated = [...state.envVars]
    updated[index] = { ...updated[index], [field]: value }
    onChange({ envVars: updated })
  }

  // Mod target management
  const addModTarget = () => {
    onChange({ mods: { ...state.mods, targets: [...(state.mods.targets || []), { ...defaultModTarget }] } })
  }
  const removeModTarget = (index: number) => {
    onChange({ mods: { ...state.mods, targets: state.mods.targets?.filter((_, i) => i !== index) } })
  }
  const updateModTarget = (index: number, field: keyof ModTarget, value: string) => {
    const updated = [...(state.mods.targets || [])]
    updated[index] = { ...updated[index], [field]: value }
    onChange({ mods: { ...state.mods, targets: updated } })
  }

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <section className="border border-border bg-card">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-bold uppercase tracking-wide">Basic Information</h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pack-id" className="text-xs font-bold uppercase text-muted-foreground">Pack ID</Label>
              <Input
                id="pack-id"
                placeholder="e.g. minecraft-java"
                value={state.packId}
                onChange={(e) => onChange({ packId: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                className="font-mono"
                required
              />
              {!isEditMode && (
                <p className="text-xs text-muted-foreground">
                  Unique identifier using lowercase letters, numbers, and dashes.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="pack-version" className="text-xs font-bold uppercase text-muted-foreground">Version</Label>
              <Input
                id="pack-version"
                placeholder="1.0.0"
                value={state.packVersion}
                onChange={(e) => onChange({ packVersion: e.target.value })}
                className="font-mono"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pack-name" className="text-xs font-bold uppercase text-muted-foreground">Display Name</Label>
            <Input
              id="pack-name"
              placeholder="e.g. Minecraft Java Edition"
              value={state.packName}
              onChange={(e) => onChange({ packName: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pack-description" className="text-xs font-bold uppercase text-muted-foreground">Description</Label>
            <Textarea
              id="pack-description"
              placeholder="A brief description of this game pack..."
              value={state.packDescription}
              onChange={(e) => onChange({ packDescription: e.target.value })}
              rows={2}
            />
          </div>
        </div>
      </section>

      {/* Runtime */}
      <section className="border border-border bg-card">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-bold uppercase tracking-wide">Runtime Configuration</h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase text-muted-foreground">
              Docker Image
              <HelpTooltip>The base Docker image that contains the runtime environment. Usually a minimal Linux image or a game-specific image from Docker Hub.</HelpTooltip>
            </Label>
            <Input
              placeholder="e.g. itzg/minecraft-server:latest"
              value={state.dockerImage}
              onChange={(e) => onChange({ dockerImage: e.target.value })}
              className="font-mono"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">
                Data Mount Path
                <HelpTooltip>Path inside the container where server data will be stored. This is mapped to persistent storage on the host.</HelpTooltip>
              </Label>
              <Input
                placeholder="/data"
                value={state.mountPath}
                onChange={(e) => onChange({ mountPath: e.target.value })}
                className="font-mono"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">
                Working Directory
                <HelpTooltip>The directory where commands will be executed. Usually the same as the data mount path.</HelpTooltip>
              </Label>
              <Input
                placeholder="/data (optional)"
                value={state.workdir}
                onChange={(e) => onChange({ workdir: e.target.value })}
                className="font-mono"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">
                User
                <HelpTooltip>The user:group to run the container as (e.g., "1000:1000"). Useful for matching host file permissions.</HelpTooltip>
              </Label>
              <Input
                placeholder="1000:1000 (optional)"
                value={state.user}
                onChange={(e) => onChange({ user: e.target.value })}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">
                Entrypoint
                <HelpTooltip>Override the container's default entrypoint. Use when you need to run the start command through a specific shell.</HelpTooltip>
              </Label>
              <Input
                placeholder="/bin/sh -c (optional)"
                value={state.entrypoint}
                onChange={(e) => onChange({ entrypoint: e.target.value })}
                className="font-mono"
              />
            </div>
          </div>

          {/* Runtime Environment Variables */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase text-muted-foreground">Environment Variables</Label>
            <div className="space-y-2">
              {Object.entries(state.runtimeEnv).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <Input value={key} disabled className="font-mono text-sm flex-1" />
                  <Input value={value} disabled className="font-mono text-sm flex-1" />
                  <Button type="button" variant="ghost" size="icon-xs" onClick={() => removeRuntimeEnv(key)} className="text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Input
                  placeholder="KEY"
                  value={newEnvKey}
                  onChange={(e) => setNewEnvKey(e.target.value.toUpperCase())}
                  className="font-mono text-sm flex-1"
                />
                <Input
                  placeholder="value"
                  value={newEnvValue}
                  onChange={(e) => setNewEnvValue(e.target.value)}
                  className="font-mono text-sm flex-1"
                />
                <Button type="button" variant="outline" size="icon-xs" onClick={addRuntimeEnv} disabled={!newEnvKey}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Start Command */}
      <section className="border border-border bg-card">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-bold uppercase tracking-wide">Start Command</h2>
        </div>
        <div className="p-5">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase text-muted-foreground">Command</Label>
            <Input
              placeholder="e.g. java -jar server.jar"
              value={state.startCommand}
              onChange={(e) => onChange({ startCommand: e.target.value })}
              className="font-mono"
              required
            />
            <p className="text-xs text-muted-foreground">
              The command used to start the server. Space-separated arguments.
            </p>
          </div>
        </div>
      </section>

      {/* Install */}
      <section className="border border-border bg-card">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-bold uppercase tracking-wide">Installation</h2>
          <p className="text-xs text-muted-foreground mt-1">
            How server files should be installed on first run.
          </p>
        </div>
        <div className="p-5 space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase text-muted-foreground">Install Method</Label>
            <Select
              key={`install-method-${initialized}`}
              value={state.install.method || "none"}
              onValueChange={(value: 'none' | 'download' | 'steamcmd') => onChange({ install: { ...state.install, method: value } })}
            >
              <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="download">Download (HTTP/HTTPS)</SelectItem>
                <SelectItem value="steamcmd">SteamCMD</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {state.install.method === "download" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Download URL</Label>
                  <Input
                    placeholder="https://example.com/server.zip"
                    value={state.install.url || ""}
                    onChange={(e) => onChange({ install: { ...state.install, url: e.target.value } })}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Destination</Label>
                  <Input
                    placeholder="/data"
                    value={state.install.dest || ""}
                    onChange={(e) => onChange({ install: { ...state.install, dest: e.target.value } })}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Checksum (optional)</Label>
                <Input
                  placeholder="sha256:..."
                  value={state.install.checksum || ""}
                  onChange={(e) => onChange({ install: { ...state.install, checksum: e.target.value } })}
                  className="font-mono text-sm"
                />
              </div>
            </>
          )}

          {state.install.method === "steamcmd" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Steam App ID</Label>
                <Input
                  type="number"
                  placeholder="730"
                  value={state.install.appId || ""}
                  onChange={(e) => onChange({ install: { ...state.install, appId: parseInt(e.target.value) || undefined } })}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Branch (optional)</Label>
                <Input
                  placeholder="public"
                  value={state.install.branch || ""}
                  onChange={(e) => onChange({ install: { ...state.install, branch: e.target.value } })}
                  className="font-mono text-sm"
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Variables */}
      <section className="border border-border bg-card">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide">Variables</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Configuration options exposed to server instances.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addVariable}>
            <Plus className="h-3 w-3 mr-1" />
            Add Variable
          </Button>
        </div>
        <div className="p-5 space-y-4">
          {state.variables.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No variables defined. Click "Add Variable" to create one.
            </div>
          ) : (
            state.variables.map((variable, index) => (
              <div key={index} className="border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-muted-foreground">Variable {index + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => removeVariable(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Name</Label>
                    <Input
                      placeholder="SERVER_PORT"
                      value={variable.name}
                      onChange={(e) => updateVariable(index, 'name', e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Label</Label>
                    <Input
                      placeholder="Server Port"
                      value={variable.label}
                      onChange={(e) => updateVariable(index, 'label', e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
                    <Select
                      value={variable.type}
                      onValueChange={(value) => updateVariable(index, 'type', value)}
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="string">String</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="boolean">Boolean</SelectItem>
                        <SelectItem value="select">Select</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Default Value</Label>
                    <Input
                      placeholder="Default value"
                      value={String(variable.default || "")}
                      onChange={(e) => updateVariable(index, 'default', e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Description</Label>
                    <Input
                      placeholder="Brief description"
                      value={variable.description}
                      onChange={(e) => updateVariable(index, 'description', e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>
                {variable.type === "select" && (
                  <div className="space-y-1">
                    <Label className="text-xs">Options (comma-separated)</Label>
                    <Input
                      placeholder="option1, option2, option3"
                      value={(variable.options || []).join(", ")}
                      onChange={(e) => updateVariable(index, 'options', e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                      className="text-sm"
                    />
                  </div>
                )}
                {variable.type === "number" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Min Value</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={variable.min ?? ""}
                        onChange={(e) => updateVariable(index, 'min', e.target.value ? parseInt(e.target.value) : undefined)}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Max Value</Label>
                      <Input
                        type="number"
                        placeholder="65535"
                        value={variable.max ?? ""}
                        onChange={(e) => updateVariable(index, 'max', e.target.value ? parseInt(e.target.value) : undefined)}
                        className="text-sm"
                      />
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`required-${index}`}
                    checked={variable.required}
                    onCheckedChange={(checked) => updateVariable(index, 'required', checked)}
                  />
                  <Label htmlFor={`required-${index}`} className="text-xs">Required</Label>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Ports */}
      <section className="border border-border bg-card">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide">Network Ports</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Define the ports the server will expose.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addPort}>
            <Plus className="h-3 w-3 mr-1" />
            Add Port
          </Button>
        </div>
        <div className="p-5 space-y-4">
          {state.ports.map((port, index) => (
            <div key={index} className="border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-muted-foreground">Port {index + 1}</span>
                {state.ports.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => removePort(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Name</Label>
                  <Input
                    placeholder="game"
                    value={port.name}
                    onChange={(e) => updatePort(index, 'name', e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Container Port</Label>
                  <Input
                    type="number"
                    placeholder="25565"
                    value={port.containerPort}
                    onChange={(e) => updatePort(index, 'containerPort', parseInt(e.target.value) || 0)}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Protocol</Label>
                  <Select value={port.protocol} onValueChange={(value) => updatePort(index, 'protocol', value)}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tcp">TCP</SelectItem>
                      <SelectItem value="udp">UDP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Host Port Mode</Label>
                  <Select value={port.hostPortMode} onValueChange={(value) => updatePort(index, 'hostPortMode', value)}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Input
                  placeholder="Main game port"
                  value={port.description}
                  onChange={(e) => updatePort(index, 'description', e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Health Check */}
      <section className="border border-border bg-card">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-bold uppercase tracking-wide">Health Check</h2>
          <p className="text-xs text-muted-foreground mt-1">
            How to determine if the server is healthy and ready.
          </p>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Check Type</Label>
              <Select
                key={`health-type-${initialized}`}
                value={state.health.type || "process"}
                onValueChange={(value: 'tcp' | 'udp' | 'process' | 'http') => onChange({ health: { ...state.health, type: value } })}
              >
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="process">Process</SelectItem>
                  <SelectItem value="tcp">TCP Port</SelectItem>
                  <SelectItem value="udp">UDP Port</SelectItem>
                  <SelectItem value="http">HTTP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(state.health.type === "tcp" || state.health.type === "udp" || state.health.type === "http") && (
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Port</Label>
                <Input
                  type="number"
                  placeholder="25565"
                  value={state.health.port || ""}
                  onChange={(e) => onChange({ health: { ...state.health, port: parseInt(e.target.value) || undefined } })}
                  className="font-mono"
                />
              </div>
            )}
          </div>
          {state.health.type === "http" && (
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">HTTP Path</Label>
              <Input
                placeholder="/health"
                value={state.health.path || ""}
                onChange={(e) => onChange({ health: { ...state.health, path: e.target.value } })}
                className="font-mono"
              />
            </div>
          )}
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Grace Period (s)</Label>
              <Input
                type="number"
                value={state.health.gracePeriod || 30}
                onChange={(e) => onChange({ health: { ...state.health, gracePeriod: parseInt(e.target.value) || 30 } })}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Interval (s)</Label>
              <Input
                type="number"
                value={state.health.interval || 10}
                onChange={(e) => onChange({ health: { ...state.health, interval: parseInt(e.target.value) || 10 } })}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Timeout (s)</Label>
              <Input
                type="number"
                value={state.health.timeout || 5}
                onChange={(e) => onChange({ health: { ...state.health, timeout: parseInt(e.target.value) || 5 } })}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Retries</Label>
              <Input
                type="number"
                value={state.health.retries || 3}
                onChange={(e) => onChange({ health: { ...state.health, retries: parseInt(e.target.value) || 3 } })}
                className="font-mono"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Shutdown */}
      <section className="border border-border bg-card">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-bold uppercase tracking-wide">Shutdown</h2>
          <p className="text-xs text-muted-foreground mt-1">
            How to gracefully stop the server.
          </p>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Signal</Label>
              <Select
                key={`shutdown-signal-${initialized}`}
                value={state.shutdown.signal || "SIGTERM"}
                onValueChange={(value) => onChange({ shutdown: { ...state.shutdown, signal: value } })}
              >
                <SelectTrigger><SelectValue placeholder="Select signal" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SIGTERM">SIGTERM</SelectItem>
                  <SelectItem value="SIGINT">SIGINT</SelectItem>
                  <SelectItem value="SIGKILL">SIGKILL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Timeout (s)</Label>
              <Input
                type="number"
                value={state.shutdown.timeout || 30}
                onChange={(e) => onChange({ shutdown: { ...state.shutdown, timeout: parseInt(e.target.value) || 30 } })}
                className="font-mono"
              />
            </div>
          </div>
        </div>
      </section>

      {/* RCON */}
      <section className="border border-border bg-card">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide">RCON</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Remote console configuration for server commands.
            </p>
          </div>
          <Checkbox
            checked={state.rcon.enabled}
            onCheckedChange={(checked) => onChange({ rcon: { ...state.rcon, enabled: !!checked } })}
          />
        </div>
        {state.rcon.enabled && (
          <div className="p-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Port Name</Label>
                <Input
                  placeholder="rcon"
                  value={state.rcon.portName}
                  onChange={(e) => onChange({ rcon: { ...state.rcon, portName: e.target.value } })}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  References a port defined above.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Password Variable</Label>
                <Input
                  placeholder="RCON_PASSWORD"
                  value={state.rcon.passwordVariable}
                  onChange={(e) => onChange({ rcon: { ...state.rcon, passwordVariable: e.target.value } })}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  References a variable defined above.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Config Rendering */}
      <section className="border border-border bg-card">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-bold uppercase tracking-wide">Config Rendering</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Template files and environment variables to render on server start.
          </p>
        </div>
        <div className="p-5 space-y-6">
          {/* Templates */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase text-muted-foreground">
                Templates
                <HelpTooltip>
                  Define which template files to render on server start. {isEditMode ? "Template files should be created in the Pack Files section below." : "After creating the pack, add template files in the edit page."} Use Go template syntax with {"{{.VariableName}}"} to insert variable values.
                </HelpTooltip>
              </Label>
              <Button type="button" variant="outline" size="sm" onClick={addTemplate}>
                <Plus className="h-3 w-3 mr-1" />
                Add Template
              </Button>
            </div>
            {state.templates.length === 0 ? (
              <div className="text-center py-4 border border-dashed border-border">
                <p className="text-xs text-muted-foreground">
                  No templates defined. Templates are rendered with variable values on server start.
                </p>
                {!isEditMode && (
                  <p className="text-xs text-muted-foreground mt-1">
                    After creating the pack, add template files in the edit page.
                  </p>
                )}
              </div>
            ) : (
              state.templates.map((template, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder="templates/server.properties.tmpl"
                    value={template.source}
                    onChange={(e) => updateTemplate(index, 'source', e.target.value)}
                    className="font-mono text-sm flex-1"
                  />
                  <span className="text-muted-foreground">→</span>
                  <Input
                    placeholder="server.properties"
                    value={template.destination}
                    onChange={(e) => updateTemplate(index, 'destination', e.target.value)}
                    className="font-mono text-sm flex-1"
                  />
                  <Button type="button" variant="ghost" size="icon-xs" onClick={() => removeTemplate(index)} className="text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))
            )}
          </div>

          {/* Environment Variable Rendering */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase text-muted-foreground">
                Environment Variables
                <HelpTooltip>
                  Environment variables passed to the container. Check "Template" to process the value using Go template syntax before passing it.
                </HelpTooltip>
              </Label>
              <Button type="button" variant="outline" size="sm" onClick={addEnvVar}>
                <Plus className="h-3 w-3 mr-1" />
                Add Env Var
              </Button>
            </div>
            {state.envVars.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No environment variables defined.
              </p>
            ) : (
              state.envVars.map((envVar, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder="ENV_NAME"
                    value={envVar.name}
                    onChange={(e) => updateEnvVar(index, 'name', e.target.value.toUpperCase())}
                    className="font-mono text-sm w-40"
                  />
                  <Input
                    placeholder="value or {{.Variable}}"
                    value={envVar.value}
                    onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
                    className="font-mono text-sm flex-1"
                  />
                  <div className="flex items-center gap-1">
                    <Checkbox
                      checked={envVar.template}
                      onCheckedChange={(checked) => updateEnvVar(index, 'template', !!checked)}
                    />
                    <Label className="text-xs">Template</Label>
                  </div>
                  <Button type="button" variant="ghost" size="icon-xs" onClick={() => removeEnvVar(index)} className="text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Mods */}
      <section className="border border-border bg-card">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide">Mods</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Enable mod support for this game pack.
            </p>
          </div>
          <Checkbox
            checked={state.mods.enabled}
            onCheckedChange={(checked) => onChange({ mods: { ...state.mods, enabled: !!checked } })}
          />
        </div>
        {state.mods.enabled && (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={state.mods.applyWhileRunning}
                onCheckedChange={(checked) => onChange({ mods: { ...state.mods, applyWhileRunning: !!checked } })}
              />
              <Label className="text-xs">Allow applying mods while server is running</Label>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Mod Targets</Label>
                <Button type="button" variant="outline" size="sm" onClick={addModTarget}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add Target
                </Button>
              </div>
              {(!state.mods.targets || state.mods.targets.length === 0) ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No mod targets defined.
                </p>
              ) : (
                state.mods.targets.map((target, index) => (
                  <div key={index} className="border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-muted-foreground">Target {index + 1}</span>
                      <Button type="button" variant="ghost" size="icon-xs" onClick={() => removeModTarget(index)} className="text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Name</Label>
                        <Input
                          placeholder="plugins"
                          value={target.name}
                          onChange={(e) => updateModTarget(index, 'name', e.target.value)}
                          className="font-mono text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Path</Label>
                        <Input
                          placeholder="/data/plugins"
                          value={target.path}
                          onChange={(e) => updateModTarget(index, 'path', e.target.value)}
                          className="font-mono text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Behavior</Label>
                        <Select
                          value={target.behavior || "merge"}
                          onValueChange={(value) => updateModTarget(index, 'behavior', value)}
                        >
                          <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="merge">Merge</SelectItem>
                            <SelectItem value="clean-then-merge">Clean Then Merge</SelectItem>
                            <SelectItem value="replace">Replace</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
