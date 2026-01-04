import { createFileRoute, useNavigate, Link } from "@tanstack/react-router"
import { useQuery, useMutation } from "@tanstack/react-query"
import { api } from "../../lib/api"
import type { VariableConfig } from "../../lib/api"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Box, ArrowRight, Check } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/servers/new")({
  component: NewServerPage,
  staticData: {
    title: "New Server",
  },
})

function VariableInput({
  variable,
  value,
  onChange,
}: {
  variable: VariableConfig
  value: unknown
  onChange: (value: unknown) => void
}) {
  if (variable.type === "select" && variable.options) {
    return (
      <Select value={String(value || "")} onValueChange={onChange}>
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

  if (variable.type === "boolean") {
    return (
      <Select
        value={String(value || "false")}
        onValueChange={(v) => onChange(v === "true")}
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

  if (variable.type === "number") {
    return (
      <Input
        type="number"
        value={String(value || "")}
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
      value={String(value || "")}
      onChange={(e) => onChange(e.target.value)}
      className="w-full"
    />
  )
}

function NewServerPage() {
  const navigate = useNavigate()
  const [selectedPackId, setSelectedPackId] = useState<string>("")
  const [serverName, setServerName] = useState("")
  const [variables, setVariables] = useState<Record<string, unknown>>({})

  const { data: packs, isLoading: packsLoading } = useQuery({
    queryKey: ["packs"],
    queryFn: api.packs.list,
  })

  const { data: selectedPack } = useQuery({
    queryKey: ["packs", selectedPackId],
    queryFn: () => api.packs.get(selectedPackId),
    enabled: !!selectedPackId,
  })

  const createMutation = useMutation({
    mutationFn: api.servers.create,
    onSuccess: (server) => {
      navigate({ to: "/servers/$serverId", params: { serverId: server.id } })
    },
  })

  const handlePackChange = (packId: string) => {
    setSelectedPackId(packId)
    setVariables({})
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPackId || !serverName) return

    const mergedVariables: Record<string, unknown> = {}
    if (selectedPack?.variables) {
      for (const variable of selectedPack.variables) {
        mergedVariables[variable.name] =
          variables[variable.name] ?? variable.default
      }
    }

    createMutation.mutate({
      name: serverName,
      packId: selectedPackId,
      variables: mergedVariables,
    })
  }

  return (
    <div className="flex-1 p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left column - Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Server Name */}
            <section className="border border-border bg-card">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="text-sm font-bold uppercase tracking-wide text-textMain">Server Details</h2>
              </div>
              <div className="p-5">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs font-bold uppercase text-textMuted">Server Name</Label>
                  <Input
                    id="name"
                    value={serverName}
                    onChange={(e) => setServerName(e.target.value)}
                    placeholder="e.g. My Survival World"
                    required
                    className="h-11 text-base bg-transparent border-border focus-visible:ring-0 focus-visible:border-brand"
                    autoFocus
                  />
                  <p className="text-xs text-textMuted">
                    A friendly name to identify your server.
                  </p>
                </div>
              </div>
            </section>

            {/* Game Selection */}
            <section className="border border-border bg-card">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="text-sm font-bold uppercase tracking-wide text-textMain">Select Game</h2>
              </div>
              <div className="p-5">
                {packsLoading ? (
                  <div className="flex items-center justify-center p-12 border border-dashed border-border">
                    <Loader2 className="h-6 w-6 animate-spin text-textMuted" />
                  </div>
                ) : packs && packs.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {packs.map((pack) => (
                      <button
                        type="button"
                        key={pack.id}
                        onClick={() => handlePackChange(pack.id)}
                        className={cn(
                          "group relative flex items-start gap-4 p-4 border text-left transition-colors",
                          selectedPackId === pack.id
                            ? "border-brand bg-brand/5"
                            : "border-border bg-transparent"
                        )}
                      >
                        <div className={cn(
                          "h-10 w-10 flex items-center justify-center shrink-0 border",
                          selectedPackId === pack.id
                            ? "bg-brand text-white border-brand"
                            : "bg-surface text-textMuted border-border"
                        )}>
                          <Box className="h-5 w-5" />
                        </div>
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="font-semibold text-sm text-textMain truncate">{pack.name}</div>
                          <p className="text-xs text-textMuted line-clamp-2">
                            {pack.description}
                          </p>
                        </div>
                        {selectedPackId === pack.id && (
                          <div className="absolute top-3 right-3 h-5 w-5 bg-brand text-white flex items-center justify-center">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="border border-dashed border-border p-8 text-center">
                    <Box className="h-8 w-8 text-textMuted/50 mx-auto mb-3" />
                    <h3 className="text-sm font-semibold text-textMain mb-1">No game packs found</h3>
                    <p className="text-xs text-textMuted mb-4">
                      Import a game pack before creating a server.
                    </p>
                    <Link to="/packs">
                      <Button variant="outline" size="sm" className="border-border">
                        Import Game Pack
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </section>

            {/* Configuration */}
            {selectedPack && selectedPack.variables.length > 0 && (
              <section className="border border-border bg-card animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="px-5 py-4 border-b border-border">
                  <h2 className="text-sm font-bold uppercase tracking-wide text-textMain">Configuration</h2>
                  <p className="text-xs text-textMuted mt-1">
                    Startup variables for {selectedPack.name}
                  </p>
                </div>
                <div className="p-5 grid gap-5 sm:grid-cols-2">
                  {selectedPack.variables.map((variable) => (
                    <div key={variable.name} className="space-y-2">
                      <Label htmlFor={variable.name} className="flex items-center gap-1 text-xs font-bold uppercase text-textMuted">
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
                        <p className="text-xs text-textMuted">
                          {variable.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </form>
        </div>

        {/* Right column - Summary & Action */}
        <div className="lg:col-span-1">
          <div className="border border-border bg-card sticky top-24">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-bold uppercase tracking-wide text-textMain">Summary</h2>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-textMuted">Server Name</span>
                  <span className="text-textMain font-medium truncate ml-4">
                    {serverName || "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-textMuted">Game</span>
                  <span className="text-textMain font-medium">
                    {selectedPack?.name || "—"}
                  </span>
                </div>
                {selectedPack && (
                  <div className="flex justify-between">
                    <span className="text-textMuted">Variables</span>
                    <span className="text-textMain font-medium">
                      {selectedPack.variables.length}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-border">
                <Button
                  type="submit"
                  onClick={handleSubmit}
                  disabled={!selectedPackId || !serverName || createMutation.isPending}
                  className="w-full h-11 font-semibold bg-brand hover:bg-brand/90 text-white"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Deploying...
                    </>
                  ) : (
                    <>
                      Deploy Server
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>

                {createMutation.error && (
                  <div className="mt-3 p-3 bg-destructive/10 text-destructive text-xs text-center">
                    {createMutation.error.message}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
