import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="border-2 border-dashed border-border bg-muted/20 p-12 text-center">
      <div className="flex flex-col items-center justify-center">
        <div className="h-16 w-16 bg-muted border-2 border-border flex items-center justify-center mb-4">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-bold mb-2 uppercase">{title}</h3>
        <p className="text-muted-foreground max-w-sm mb-6 font-mono text-sm">
          {description}
        </p>
        {action}
      </div>
    </div>
  )
}
