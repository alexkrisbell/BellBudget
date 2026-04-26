import { Crown, User } from 'lucide-react'

interface Member {
  id: string
  role: string
  joined_at: string
  user: { id: string; full_name: string; email: string } | null
}

interface Props {
  members: Member[]
  currentUserId: string
}

export function MembersCard({ members, currentUserId }: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">
        Members ({members.length})
      </p>
      <ul className="space-y-3">
        {members.map((m) => {
          const isYou = m.user?.id === currentUserId
          return (
            <li key={m.id} className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">
                  {m.user?.full_name ?? m.user?.email ?? 'Unknown'}
                  {isYou && <span className="ml-1.5 text-xs text-slate-400 font-normal">(you)</span>}
                </p>
                <p className="text-xs text-slate-400 truncate">{m.user?.email}</p>
              </div>
              <div className="shrink-0 flex items-center gap-1 text-xs text-slate-500">
                {m.role === 'owner' && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                <span className="capitalize">{m.role}</span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
