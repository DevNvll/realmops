import { createFileRoute } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "../lib/api"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { Package, Upload, Loader2, FolderOpen } from "lucide-react"
import { useRef, useState } from "react"

export const Route = createFileRoute("/packs")({
  component: PacksPage,
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

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold">Game Packs</h1>
        </div>
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
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
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
              <Button>
                <FolderOpen className="h-4 w-4 mr-2" />
                Import Folder
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import Pack from Folder</DialogTitle>
                <DialogDescription>
                  Enter the path to a folder containing a pack.yaml file
                </DialogDescription>
              </DialogHeader>
              <Input
                placeholder="C:\path\to\pack or /path/to/pack"
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
              />
              {importPathMutation.error && (
                <p className="text-sm text-destructive">
                  {importPathMutation.error.message}
                </p>
              )}
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
                  Import
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">
              Failed to load packs: {error.message}
            </p>
          </CardContent>
        </Card>
      )}

      {packs && packs.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-center py-12">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              No game packs installed
            </h3>
            <p className="text-muted-foreground mb-4">
              Import a pack.zip file to add support for a new game.
            </p>
            <Button onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Import Pack
            </Button>
          </CardContent>
        </Card>
      )}

      {packs && packs.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {packs.map((pack) => (
            <Card key={pack.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle>{pack.name}</CardTitle>
                <CardDescription>
                  {pack.id} v{pack.version}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {pack.description}
                </p>
                <div className="text-sm space-y-1">
                  <div>
                    <span className="font-medium">Variables:</span>{" "}
                    {pack.variables.length}
                  </div>
                  <div>
                    <span className="font-medium">Ports:</span>{" "}
                    {pack.ports
                      .map((p) => `${p.containerPort}/${p.protocol}`)
                      .join(", ")}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
