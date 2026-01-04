import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  fullHeight?: boolean
}

export function LoadingSpinner({ className, size = 'md', fullHeight = true }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  }

  return (
    <div className={cn(
      'flex justify-center items-center',
      fullHeight && 'h-64',
      className
    )}>
      <Loader2 className={cn('animate-spin text-primary', sizeClasses[size])} />
    </div>
  )
}
