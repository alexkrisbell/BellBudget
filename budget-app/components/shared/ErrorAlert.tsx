import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  title?: string
  message: string
  className?: string
}

export function ErrorAlert({ title = 'Something went wrong', message, className }: Props) {
  return (
    <div className={cn('rounded-xl border border-red-200 bg-red-50 p-4', className)}>
      <div className="flex items-start gap-3">
        <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-red-700">{title}</p>
          <p className="text-sm text-red-600 mt-0.5">{message}</p>
        </div>
      </div>
    </div>
  )
}
