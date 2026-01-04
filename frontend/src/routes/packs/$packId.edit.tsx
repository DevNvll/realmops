import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "../../lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Loader2, Plus, Trash2, Package, Save, File, Folder, Upload, ChevronRight } from "lucide-react"
import { useState, useEffect, useRef } from "react"
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
import type { CreatePackRequest, FileEntry, ConfigRendering } from "@/lib/api/types"

export const Route = createFileRoute("/packs/$packId/edit")({
  component: EditPackPage,
  staticData: {
    title: "Edit Game Pack",
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

function EditPackPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { packId } = Route.useParams()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [formState, setFormState] = useState<PackFormState>(initialFormState)
  const [initialized, setInitialized] = useState(false)

  // File management state
  const [currentPath, setCurrentPath] = useState<string[]>([])
  const [newFileName, setNewFileName] = useState("")
  const [newFileDialogOpen, setNewFileDialogOpen] = useState(false)
  const [newFileContent, setNewFileContent] = useState("")
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)

  const { data: pack, isLoading, error } = useQuery({
    queryKey: ["packs", packId],
    queryFn: () => api.packs.get(packId),
  })

  const { data: files, refetch: refetchFiles } = useQuery({
    queryKey: ["packs", packId, "files", currentPath.join("/")],
    queryFn: () => api.packs.files.list(packId, currentPath.join("/")),
    enabled: !!packId,
  })

  // Initialize form with pack data
  useEffect(() => {
    if (pack && !initialized) {
      const installMethod = pack.install?.method
      const validInstallMethod = (installMethod === "download" || installMethod === "steamcmd") ? installMethod : "none"

      setFormState({
        packId: pack.id,
        packName: pack.name,
        packVersion: pack.version,
        packDescription: pack.description || "",
        dockerImage: pack.runtime?.image || "",
        mountPath: pack.storage?.mountPath || "/data",
        startCommand: pack.start?.command?.join(" ") || "",
        ports: pack.ports?.length > 0 ? pack.ports : [{ ...defaultPort }],
        variables: pack.variables || [],
        workdir: pack.runtime?.workdir || "",
        user: pack.runtime?.user || "",
        entrypoint: pack.runtime?.entrypoint?.join(" ") || "",
        runtimeEnv: pack.runtime?.env || {},
        install: pack.install ? { ...pack.install, method: validInstallMethod } : { ...defaultInstall },
        health: pack.health ? { ...defaultHealth, ...pack.health, type: pack.health.type || "process" } : { ...defaultHealth },
        shutdown: pack.shutdown ? { ...defaultShutdown, ...pack.shutdown, signal: pack.shutdown.signal || "SIGTERM" } : { ...defaultShutdown },
        rcon: pack.rcon || { ...defaultRCON },
        templates: pack.config?.templates || [],
        envVars: pack.config?.envVars || [],
        mods: pack.mods || { ...defaultMods },
      })

      setInitialized(true)
    }
  }, [pack, initialized])

  const handleFormChange = (updates: Partial<PackFormState>) => {
    setFormState(prev => ({ ...prev, ...updates }))
  }

  const updateMutation = useMutation({
    mutationFn: (data: CreatePackRequest) => api.packs.update(packId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packs"] })
      navigate({ to: "/packs" })
    },
  })

  const uploadFileMutation = useMutation({
    mutationFn: ({ path, content }: { path: string; content: string }) =>
      api.packs.files.put(packId, path, content),
    onSuccess: () => {
      refetchFiles()
      setNewFileDialogOpen(false)
      setNewFileName("")
      setNewFileContent("")
    },
  })

  const deleteFileMutation = useMutation({
    mutationFn: (path: string) => api.packs.files.delete(packId, path),
    onSuccess: () => refetchFiles(),
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

    updateMutation.mutate(data)
  }

  // File management
  const navigateToFolder = (folderName: string) => {
    setCurrentPath([...currentPath, folderName])
  }
  const navigateUp = () => {
    setCurrentPath(currentPath.slice(0, -1))
  }
  const navigateToPathIndex = (index: number) => {
    setCurrentPath(currentPath.slice(0, index + 1))
  }

  const handleCreateFile = () => {
    if (!newFileName) return
    const fullPath = [...currentPath, newFileName].join("/")
    if (isCreatingFolder) {
      uploadFileMutation.mutate({ path: `${fullPath}/.gitkeep`, content: "" })
    } else {
      uploadFileMutation.mutate({ path: fullPath, content: newFileContent })
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const content = await file.text()
    const fullPath = [...currentPath, file.name].join("/")
    uploadFileMutation.mutate({ path: fullPath, content })
    e.target.value = ""
  }

  const isFormValid = formState.packId && formState.packName && formState.dockerImage && formState.startCommand && formState.ports.some(p => p.name && p.containerPort > 0)

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 p-6">
        <div className="border-2 border-destructive bg-destructive/5 p-6">
          <p className="text-destructive font-bold uppercase">
            Failed to load pack: {error.message}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left column - Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="space-y-6">
            <PackForm
              state={formState}
              onChange={handleFormChange}
              initialized={initialized}
              isEditMode
            />

            {/* Files */}
            <section className="border border-border bg-card">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wide">Pack Files</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Templates, configs, and other files included in this pack.
                  </p>
                </div>
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-3 w-3 mr-1" />
                    Upload
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => { setIsCreatingFolder(false); setNewFileDialogOpen(true) }}>
                    <File className="h-3 w-3 mr-1" />
                    New File
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => { setIsCreatingFolder(true); setNewFileDialogOpen(true) }}>
                    <Folder className="h-3 w-3 mr-1" />
                    New Folder
                  </Button>
                </div>
              </div>
              <div className="p-5">
                {/* Breadcrumb */}
                <div className="flex items-center gap-1 text-sm mb-4 font-mono">
                  <button
                    type="button"
                    onClick={() => setCurrentPath([])}
                    className="text-primary hover:underline"
                  >
                    root
                  </button>
                  {currentPath.map((segment, index) => (
                    <span key={index} className="flex items-center gap-1">
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      <button
                        type="button"
                        onClick={() => navigateToPathIndex(index)}
                        className="text-primary hover:underline"
                      >
                        {segment}
                      </button>
                    </span>
                  ))}
                </div>

                {/* File list */}
                <div className="border border-border divide-y divide-border">
                  {currentPath.length > 0 && (
                    <button
                      type="button"
                      onClick={navigateUp}
                      className="w-full flex items-center gap-3 px-4 py-2 hover:bg-muted/50 text-left"
                    >
                      <Folder className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-sm">..</span>
                    </button>
                  )}
                  {files && files.length > 0 ? (
                    files
                      .filter((f: FileEntry) => f.name !== "pack.yaml")
                      .sort((a: FileEntry, b: FileEntry) => {
                        if (a.isDir && !b.isDir) return -1
                        if (!a.isDir && b.isDir) return 1
                        return a.name.localeCompare(b.name)
                      })
                      .map((file: FileEntry) => (
                        <div
                          key={file.name}
                          className="flex items-center justify-between px-4 py-2 hover:bg-muted/50 group"
                        >
                          <button
                            type="button"
                            onClick={() => file.isDir && navigateToFolder(file.name)}
                            className="flex items-center gap-3 flex-1 text-left"
                            disabled={!file.isDir}
                          >
                            {file.isDir ? (
                              <Folder className="h-4 w-4 text-primary" />
                            ) : (
                              <File className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="font-mono text-sm">{file.name}</span>
                            {!file.isDir && (
                              <span className="text-xs text-muted-foreground">
                                {file.size < 1024 ? `${file.size} B` : `${(file.size / 1024).toFixed(1)} KB`}
                              </span>
                            )}
                          </button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => {
                              const fullPath = [...currentPath, file.name].join("/")
                              deleteFileMutation.mutate(fullPath)
                            }}
                            className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))
                  ) : (
                    <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                      No files in this directory.
                    </div>
                  )}
                </div>
              </div>
            </section>
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
                  disabled={!isFormValid || updateMutation.isPending}
                  className="w-full h-11 font-semibold"
                >
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>

                {updateMutation.error && (
                  <div className="mt-3 p-3 bg-destructive/10 text-destructive text-xs text-center">
                    {updateMutation.error.message}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* New File/Folder Dialog */}
      <Dialog open={newFileDialogOpen} onOpenChange={setNewFileDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isCreatingFolder ? "New Folder" : "New File"}</DialogTitle>
            <DialogDescription>
              {isCreatingFolder
                ? "Enter a name for the new folder."
                : "Create a new file in the current directory."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{isCreatingFolder ? "Folder Name" : "File Name"}</Label>
              <Input
                placeholder={isCreatingFolder ? "templates" : "config.yaml"}
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                className="font-mono"
              />
            </div>
            {!isCreatingFolder && (
              <div className="space-y-2">
                <Label>Content</Label>
                <Textarea
                  placeholder="File content..."
                  value={newFileContent}
                  onChange={(e) => setNewFileContent(e.target.value)}
                  className="font-mono text-sm min-h-[200px]"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFileDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateFile}
              disabled={!newFileName || uploadFileMutation.isPending}
            >
              {uploadFileMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
