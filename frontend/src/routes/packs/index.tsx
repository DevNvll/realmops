import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "../../lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
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
} from "@/components/ui/alert-dialog"
import { Package, Upload, Loader2, FolderOpen, Box, FileCode, Network, Plus, Pencil, Trash2 } from "lucide-react"
import { useRef, useState } from "react"
import { useHeaderActions } from "@/components/header-actions"

export const Route = createFileRoute("/packs/")({
  component: PacksPage,
  staticData: {
    title: "Game Packs",
  },
})

function PacksPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [folderPath, setFolderPath] = useState("")
  const [folderDialogOpen, setFolderDialogOpen] = useState(false)

  const {
    data: packs,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["packs"],
    queryFn: api.packs.list,
  })

  const importMutation = useMutation({
    mutationFn: api.packs.import,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packs"] })
      setUploading(false)
    },
    onError: () => setUploading(false),
  })

  const importPathMutation = useMutation({
    mutationFn: api.packs.importFromPath,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packs"] })
      setFolderDialogOpen(false)
      setFolderPath("")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: api.packs.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packs"] })
    },
  })

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploading(true)
      importMutation.mutate(file)
    }
  }

  const handleFolderImport = () => {
    if (folderPath.trim()) {
      importPathMutation.mutate(folderPath.trim())
    }
  }

  useHeaderActions(
    <div className="flex gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={handleFileUpload}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="shadow-sm"
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Upload className="h-4 w-4 mr-2" />
        )}
        Import ZIP
      </Button>
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="shadow-sm">
            <FolderOpen className="h-4 w-4 mr-2" />
            Import Folder
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Pack from Folder</DialogTitle>
            <DialogDescription>
              Enter the absolute path to a folder containing a pack.yaml file.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
               <Input
                placeholder="e.g. C:\path\to\pack or /opt/packs/minecraft"
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            {importPathMutation.error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {importPathMutation.error.message}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFolderDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleFolderImport}
              disabled={!folderPath.trim() || importPathMutation.isPending}
            >
              {importPathMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FolderOpen className="h-4 w-4 mr-2" />
              )}
              Import Pack
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Link to="/packs/new">
        <Button size="sm" className="shadow-sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Pack
        </Button>
      </Link>
    </div>
  )

  return (
    <div className="flex flex-1 flex-col gap-8 p-8 pt-6 max-w-7xl mx-auto w-full">
      <div>
        <p className="text-muted-foreground mt-1">
          Manage installed game definitions and import new ones.
        </p>
      </div>

      {isLoading && (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {error && (
        <div className="border-2 border-destructive bg-destructive/5 p-6">
          <div className="pt-0">
            <p className="text-destructive font-bold uppercase">
              Failed to load packs: {error.message}
            </p>
          </div>
        </div>
      )}

      {packs && packs.length === 0 && (
        <div className="border-2 border-dashed border-border bg-muted/20 p-12 text-center">
          <div className="flex flex-col items-center justify-center">
            <div className="h-16 w-16 bg-muted border-2 border-border flex items-center justify-center mb-4">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold mb-2 uppercase">No game packs installed</h3>
            <p className="text-muted-foreground max-w-sm mb-6 font-mono text-sm">
              Import a pack.zip file or point to a folder to add support for a new game.
            </p>
            <div className="flex gap-3">
              <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="font-bold border-2">
                <Upload className="h-4 w-4 mr-2" />
                IMPORT PACK
              </Button>
              <Link to="/packs/new">
                <Button className="font-bold border-2 border-primary">
                  <Plus className="h-4 w-4 mr-2" />
                  CREATE PACK
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {packs && packs.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {packs.map((pack) => (
            <div key={pack.id} className="border bg-card group">
              <div className="p-6 pb-3 border-b-2 border-border bg-muted/30">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold uppercase">{pack.name}</h3>
                    <div className="font-mono text-xs mt-1 flex items-center gap-2">
                      <span className="font-bold">{pack.id}</span>
                      <span className="text-muted-foreground/60">•</span>
                      <span>v{pack.version}</span>
                    </div>
                  </div>
                  <div className="h-8 w-8 bg-primary/10 text-primary flex items-center justify-center border-2 border-primary/20">
                    <Box className="h-4 w-4" />
                  </div>
                </div>
              </div>
              <div className="p-6">
                <p className="text-sm text-muted-foreground mb-6 line-clamp-2 min-h-[2.5rem] font-mono">
                  {pack.description}
                </p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono uppercase font-bold">
                    <div className="flex items-center gap-1.5 bg-muted px-2 py-1 border border-border">
                      <FileCode className="h-3.5 w-3.5" />
                      <span className="text-foreground">{pack.variables.length}</span> vars
                    </div>
                    <div className="flex items-center gap-1.5 bg-muted px-2 py-1 border border-border">
                      <Network className="h-3.5 w-3.5" />
                      <span className="text-foreground">{pack.ports.length}</span> ports
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link to="/packs/$packId/edit" params={{ packId: pack.id }}>
                      <Button variant="ghost" size="icon-xs">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon-xs" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Game Pack</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete <span className="font-bold">{pack.name}</span>? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(pack.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {deleteMutation.isPending ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 mr-2" />
                            )}
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
