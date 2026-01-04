import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useMutation } from "@tanstack/react-query"
import { api } from "../../lib/api"
import { Button } from "@/components/ui/button"
import { Loader2, ArrowRight, Package } from "lucide-react"
import { useState } from "react"
import {
  PackForm,
  defaultPort,
  defaultInstall,
  defaultHealth,
  defaultShutdown,
  defaultRCON,
  defaultMods,
} from "@/components/pack-form"
import type { PackFormState } from "@/components/pack-form"
import type { CreatePackRequest, ConfigRendering } from "@/lib/api/types"

export const Route = createFileRoute("/packs/new")({
  component: NewPackPage,
  staticData: {
    title: "Create Game Pack",
  },
})

const initialFormState: PackFormState = {
  packId: "",
  packName: "",
  packVersion: "1.0.0",
  packDescription: "",
  dockerImage: "",
  mountPath: "/data",
  startCommand: "",
  ports: [{ ...defaultPort }],
  variables: [],
  workdir: "",
  user: "",
  entrypoint: "",
  runtimeEnv: {},
  install: { ...defaultInstall },
  health: { ...defaultHealth },
  shutdown: { ...defaultShutdown },
  rcon: { ...defaultRCON },
  templates: [],
  envVars: [],
  mods: { ...defaultMods },
}

function NewPackPage() {
  const navigate = useNavigate()
  const [formState, setFormState] = useState<PackFormState>(initialFormState)

  const handleFormChange = (updates: Partial<PackFormState>) => {
    setFormState(prev => ({ ...prev, ...updates }))
  }

  const createMutation = useMutation({
    mutationFn: api.packs.create,
    onSuccess: (pack) => {
      navigate({ to: "/packs/$packId/edit", params: { packId: pack.id } })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const validPorts = formState.ports.filter(p => p.name && p.containerPort > 0)
    if (validPorts.length === 0) return

    const commandParts = formState.startCommand.split(/\s+/).filter(Boolean)
    const validVariables = formState.variables.filter(v => v.name && v.label)
    const entrypointParts = formState.entrypoint ? formState.entrypoint.split(/\s+/).filter(Boolean) : undefined

    // Build config rendering
    const configRendering: ConfigRendering | undefined =
      formState.templates.length > 0 || formState.envVars.length > 0
        ? {
            templates: formState.templates.filter(t => t.source && t.destination),
            envVars: formState.envVars.filter(e => e.name),
          }
        : undefined

    const data: CreatePackRequest = {
      id: formState.packId,
      name: formState.packName,
      version: formState.packVersion,
      description: formState.packDescription,
      runtime: {
        image: formState.dockerImage,
        workdir: formState.workdir || undefined,
        user: formState.user || undefined,
        env: Object.keys(formState.runtimeEnv).length > 0 ? formState.runtimeEnv : undefined,
        entrypoint: entrypointParts,
      },
      storage: {
        mountPath: formState.mountPath,
      },
      ports: validPorts,
      start: {
        command: commandParts,
      },
      variables: validVariables,
      install: formState.install.method !== "none" ? formState.install : undefined,
      health: formState.health,
      shutdown: formState.shutdown,
      rcon: formState.rcon.enabled ? formState.rcon : undefined,
      config: configRendering,
      mods: formState.mods.enabled ? formState.mods : undefined,
    }

    createMutation.mutate(data)
  }

  const isFormValid = formState.packId && formState.packName && formState.dockerImage && formState.startCommand && formState.ports.some(p => p.name && p.containerPort > 0)

  return (
    <div className="flex-1 p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left column - Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="space-y-6">
            <PackForm
              state={formState}
              onChange={handleFormChange}
            />

            {/* Note about files */}
            <div className="text-sm text-muted-foreground bg-muted/30 border border-border p-4">
              <p>
                <strong>Note:</strong> You can add template files and other pack files after creating the pack using the edit page.
              </p>
            </div>
          </form>
        </div>

        {/* Right column - Summary & Action */}
        <div className="lg:col-span-1">
          <div className="border border-border bg-card sticky top-24">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-bold uppercase tracking-wide">Summary</h2>
            </div>
            <div className="p-5 space-y-4">
              <div className="h-12 w-12 bg-primary/10 text-primary flex items-center justify-center border-2 border-primary/20 mx-auto">
                <Package className="h-6 w-6" />
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pack ID</span>
                  <span className="font-mono font-medium truncate ml-4">{formState.packId || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Display Name</span>
                  <span className="font-medium truncate ml-4">{formState.packName || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Version</span>
                  <span className="font-mono font-medium">{formState.packVersion || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Docker Image</span>
                  <span className="font-mono font-medium truncate ml-4 max-w-[150px]">{formState.dockerImage || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Install</span>
                  <span className="font-medium">{formState.install.method}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Variables</span>
                  <span className="font-medium">{formState.variables.filter(v => v.name && v.label).length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ports</span>
                  <span className="font-medium">{formState.ports.filter(p => p.name && p.containerPort > 0).length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">RCON</span>
                  <span className="font-medium">{formState.rcon.enabled ? "Enabled" : "Disabled"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mods</span>
                  <span className="font-medium">{formState.mods.enabled ? "Enabled" : "Disabled"}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <Button
                  type="submit"
                  onClick={handleSubmit}
                  disabled={!isFormValid || createMutation.isPending}
                  className="w-full h-11 font-semibold"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Create Pack
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
