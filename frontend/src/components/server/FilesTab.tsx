import { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { FileEntry } from '../../lib/api'
import { formatBytes } from '../../lib/utils'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { ScrollArea } from '../ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog'
import Editor from '@monaco-editor/react'
import {
  Loader2,
  FolderOpen,
  FileText,
  Folder,
  Save,
  Upload,
  Download,
  FolderPlus,
  Trash2
} from 'lucide-react'

interface FilesTabProps {
  serverId: string
}

function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const languageMap: Record<string, string> = {
    // Config files
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'ini',
    ini: 'ini',
    cfg: 'ini',
    conf: 'ini',
    properties: 'ini',
    // Programming
    js: 'javascript',
    ts: 'typescript',
    jsx: 'javascript',
    tsx: 'typescript',
    py: 'python',
    java: 'java',
    lua: 'lua',
    sh: 'shell',
    bash: 'shell',
    bat: 'bat',
    ps1: 'powershell',
    // Web
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    xml: 'xml',
    // Data
    sql: 'sql',
    md: 'markdown',
    txt: 'plaintext',
    log: 'plaintext'
  }
  return languageMap[ext] || 'plaintext'
}

export function FilesTab({ serverId }: FilesTabProps) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [currentPath, setCurrentPath] = useState('')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingFile, setLoadingFile] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [deleteEntry, setDeleteEntry] = useState<FileEntry | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { data: files, isLoading, refetch } = useQuery({
    queryKey: ['server-files', serverId, currentPath],
    queryFn: () => api.servers.files.list(serverId, currentPath)
  })

  const handleNavigate = async (entry: FileEntry) => {
    if (entry.isDir) {
      setCurrentPath(currentPath ? `${currentPath}/${entry.name}` : entry.name)
      setSelectedFile(null)
    } else {
      const filePath = currentPath ? `${currentPath}/${entry.name}` : entry.name
      setLoadingFile(true)
      setSelectedFile(filePath)
      try {
        const content = await api.servers.files.get(serverId, filePath)
        setFileContent(content)
      } finally {
        setLoadingFile(false)
      }
    }
  }

  const handleBack = () => {
    const parts = currentPath.split('/')
    parts.pop()
    setCurrentPath(parts.join('/'))
    setSelectedFile(null)
  }

  const handleSave = async () => {
    if (!selectedFile) return
    setSaving(true)
    try {
      await api.servers.files.put(serverId, selectedFile, fileContent)
    } finally {
      setSaving(false)
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const content = await file.text()
        const filePath = currentPath ? `${currentPath}/${file.name}` : file.name
        await api.servers.files.put(serverId, filePath, content)
      }
      refetch()
    } finally {
      setUploading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDownload = () => {
    if (!selectedFile) return

    // Create a blob and download
    const blob = new Blob([fileContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = selectedFile.split('/').pop() || 'file'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return

    setCreatingFolder(true)
    try {
      // Create an empty .gitkeep file to create the folder
      const folderPath = currentPath
        ? `${currentPath}/${newFolderName}/.gitkeep`
        : `${newFolderName}/.gitkeep`
      await api.servers.files.put(serverId, folderPath, '')
      setShowNewFolderDialog(false)
      setNewFolderName('')
      refetch()
    } finally {
      setCreatingFolder(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteEntry) return

    setDeleting(true)
    try {
      const path = currentPath
        ? `${currentPath}/${deleteEntry.name}`
        : deleteEntry.name
      await api.servers.files.delete(serverId, path)

      // If we deleted the currently selected file, clear selection
      if (selectedFile?.endsWith(deleteEntry.name)) {
        setSelectedFile(null)
        setFileContent('')
      }

      setDeleteEntry(null)
      refetch()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileUpload}
      />

      <div className="lg:col-span-1 flex flex-col h-full border-2 border-border bg-card">
        <div className="py-2 px-3 border-b-2 border-border bg-muted/30 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-bold overflow-hidden font-mono min-w-0">
            <FolderOpen className="h-4 w-4 shrink-0" />
            <span className="truncate" title={`/${currentPath}`}>
              /{currentPath}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleUploadClick}
              disabled={uploading}
              title="Upload files"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowNewFolderDialog(true)}
              title="New folder"
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="p-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-2 space-y-0.5">
              {currentPath && (
                <div
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded-none cursor-pointer text-sm transition-colors font-mono"
                  onClick={handleBack}
                >
                  <Folder className="h-4 w-4 text-blue-500 fill-blue-500/20" />
                  <span className="font-bold">..</span>
                </div>
              )}
              {isLoading ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                files?.map((entry) => (
                  <div
                    key={entry.name}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-none cursor-pointer text-sm transition-colors font-mono group ${
                      selectedFile?.endsWith(entry.name)
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => handleNavigate(entry)}
                  >
                    {entry.isDir ? (
                      <Folder className="h-4 w-4 text-blue-500 fill-blue-500/20" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    <span className="truncate flex-1">{entry.name}</span>
                    {!entry.isDir && (
                      <span className="text-xs opacity-70 tabular-nums">
                        {formatBytes(entry.size)}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity ${
                        selectedFile?.endsWith(entry.name)
                          ? 'text-primary-foreground hover:text-primary-foreground hover:bg-primary/80'
                          : 'text-muted-foreground hover:text-red-500'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteEntry(entry)
                      }}
                      title={`Delete ${entry.isDir ? 'folder' : 'file'}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      <div className="lg:col-span-2 flex flex-col h-full border-2 border-border bg-card">
        {selectedFile ? (
          <>
            <div className="py-2 px-4 border-b-2 border-border bg-muted/30 min-h-[53px] flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 shrink-0" />
                <span className="font-bold text-sm font-mono truncate">
                  {selectedFile}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="h-8 shadow-none"
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Download
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                  className="h-8 shadow-none"
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Save
                </Button>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              {loadingFile ? (
                <div className="flex items-center justify-center h-full bg-[#1e1e1e]">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Editor
                  key={selectedFile}
                  height="100%"
                  language={getLanguageFromFilename(selectedFile)}
                  value={fileContent}
                  onChange={(value) => setFileContent(value || '')}
                  theme="vs-dark"
                  loading={
                    <div className="flex items-center justify-center h-full bg-[#1e1e1e]">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  }
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    automaticLayout: true,
                    tabSize: 2,
                    padding: { top: 12, bottom: 12 }
                  }}
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <FileText className="h-12 w-12 mb-4 opacity-20" />
            <p className="font-mono uppercase">Select a file to view or edit</p>
            <p className="text-sm mt-2 opacity-70">
              or use the upload button to add files
            </p>
          </div>
        )}
      </div>

      {/* New Folder Dialog */}
      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Enter a name for the new folder.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateFolder()
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowNewFolderDialog(false)
                setNewFolderName('')
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateFolder}
              disabled={creatingFolder || !newFolderName.trim()}
            >
              {creatingFolder && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteEntry} onOpenChange={(open) => !open && setDeleteEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteEntry?.isDir ? 'folder' : 'file'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteEntry?.name}"?
              {deleteEntry?.isDir && ' This will delete all files and folders inside it.'}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-500 hover:bg-red-600"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
