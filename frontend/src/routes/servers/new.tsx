import { createFileRoute, useNavigate, Link } from "@tanstack/react-router"
import { useQuery, useMutation } from "@tanstack/react-query"
import { api } from "../../lib/api"
import type { VariableConfig } from "../../lib/api"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Plus, Loader2 } from "lucide-react"
import { useState } from "react"

export const Route = createFileRoute("/servers/new")({
  component: NewServerPage,
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
        <SelectTrigger>
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
        <SelectTrigger>
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
      />
    )
  }

  return (
    <Input
      type="text"
      value={String(value || "")}
      onChange={(e) => onChange(e.target.value)}
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

    // Merge default values with user-provided values
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
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="py-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">Servers</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>New Server</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Create New Server
            </CardTitle>
            <CardDescription>
              Configure and create a new game server instance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Server Name</Label>
                <Input
                  id="name"
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  placeholder="My Game Server"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pack">Game Pack</Label>
                {packsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading packs...
                  </div>
                ) : packs && packs.length > 0 ? (
                  <Select
                    value={selectedPackId}
                    onValueChange={handlePackChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a game pack" />
                    </SelectTrigger>
                    <SelectContent>
                      {packs.map((pack) => (
                        <SelectItem key={pack.id} value={pack.id}>
                          {pack.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No game packs available.{" "}
                    <Link to="/packs" className="text-primary hover:underline">
                      Import a pack
                    </Link>{" "}
                    first.
                  </p>
                )}
              </div>

              {selectedPack && selectedPack.variables.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-semibold">Configuration</h3>
                  {selectedPack.variables.map((variable) => (
                    <div key={variable.name} className="space-y-2">
                      <Label htmlFor={variable.name}>
                        {variable.label}
                        {variable.required && (
                          <span className="text-destructive ml-1">*</span>
                        )}
                      </Label>
                      {variable.description && (
                        <p className="text-xs text-muted-foreground">
                          {variable.description}
                        </p>
                      )}
                      <VariableInput
                        variable={variable}
                        value={variables[variable.name] ?? variable.default}
                        onChange={(value) =>
                          setVariables((v) => ({ ...v, [variable.name]: value }))
                        }
                      />
                    </div>
                  ))}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={
                  !selectedPackId || !serverName || createMutation.isPending
                }
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Server
                  </>
                )}
              </Button>

              {createMutation.error && (
                <p className="text-sm text-destructive">
                  {createMutation.error.message}
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
