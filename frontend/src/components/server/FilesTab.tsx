import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { FileEntry } from '../../lib/api'
import { formatBytes } from '../../lib/utils'
import { Button } from '../ui/button'
import { ScrollArea } from '../ui/scroll-area'
import Editor from '@monaco-editor/react'
import {
  Loader2,
  FolderOpen,
  FileText,
  Folder,
  Save
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
  const [currentPath, setCurrentPath] = useState('')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingFile, setLoadingFile] = useState(false)

  const { data: files, isLoading } = useQuery({
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      <div className="lg:col-span-1 flex flex-col h-full border-2 border-border bg-card">
        <div className="py-3 px-4 border-b-2 border-border bg-muted/30">
          <div className="flex items-center gap-2 text-sm font-bold overflow-hidden font-mono">
            <FolderOpen className="h-4 w-4 shrink-0" />
            <span className="truncate" title={`/${currentPath}`}>
              /{currentPath}
            </span>
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
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-none cursor-pointer text-sm transition-colors font-mono ${
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
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="font-bold text-sm font-mono">
                  {selectedFile}
                </span>
              </div>
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
                SAVE
              </Button>
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
          </div>
        )}
      </div>
    </div>
  )
}
