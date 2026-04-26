import { cn } from '@/lib/utils'

interface Props {
  current: number
  onTrack: boolean
}

export function StreakBadge({ current, onTrack }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {current > 0 && (
        <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
          <span className="text-base leading-none">🔥</span>
          <span className="text-sm font-semibold text-amber-700">
            {current} Month Streak
          </span>
        </div>
      )}
      <div
        className={cn(
          'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
          onTrack ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
        )}
      >
        <div
          className={cn('size-1.5 rounded-full', onTrack ? 'bg-green-500' : 'bg-red-500')}
        />
        {onTrack ? 'On track this month' : 'Over budget'}
      </div>
    </div>
  )
}
