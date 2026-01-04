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
import { Package, Upload, Loader2, FolderOpen, Plus, Pencil, Trash2 } from "lucide-react"
import { useRef, useState } from "react"
import { useHeaderActions } from "@/components/header-actions"
import { LoadingSpinner } from "@/components/loading-spinner"
import { ErrorAlert } from "@/components/error-alert"
import { EmptyState } from "@/components/empty-state"

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
            <DialogTitle>Import from Folder</DialogTitle>
            <DialogDescription>
              Enter the path to a folder containing a pack.yaml file.
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
          Server templates that define how game servers are deployed and configured.
        </p>
      </div>

      {isLoading && <LoadingSpinner />}

      {error && <ErrorAlert message="Failed to load packs" error={error} />}

      {packs && packs.length === 0 && (
        <EmptyState
          icon={Package}
          title="No packs yet"
          description="Create a pack or import one to start deploying game servers."
          action={
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
          }
        />
      )}

      {packs && packs.length > 0 && (
        <div className="border bg-card">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Description</th>
                <th className="px-4 py-3 font-medium text-center w-20">Vars</th>
                <th className="px-4 py-3 font-medium text-center w-20">Ports</th>
                <th className="px-4 py-3 font-medium w-24"></th>
              </tr>
            </thead>
            <tbody>
              {packs.map((pack) => (
                <tr key={pack.id} className="border-b last:border-b-0 group hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium">{pack.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {pack.id} • v{pack.version}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell">
                    <span className="line-clamp-1">{pack.description}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm tabular-nums">
                    {pack.variables.length}
                  </td>
                  <td className="px-4 py-3 text-center text-sm tabular-nums">
                    {pack.ports.length}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link to="/packs/$packId/edit" params={{ packId: pack.id }}>
                        <Button variant="ghost" size="icon-xs">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon-xs" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Pack</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete <span className="font-medium">{pack.name}</span>? This cannot be undone.
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
