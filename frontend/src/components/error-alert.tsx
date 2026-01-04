interface ErrorAlertProps {
  message: string
  error?: Error | null
}

export function ErrorAlert({ message, error }: ErrorAlertProps) {
  return (
    <div className="border-2 border-destructive bg-destructive/5 p-6">
      <p className="text-destructive font-bold uppercase">
        {message}
        {error?.message && `: ${error.message}`}
      </p>
    </div>
  )
}
