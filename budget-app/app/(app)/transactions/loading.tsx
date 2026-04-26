export default function TransactionsLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-6 bg-slate-100 rounded-full w-36" />
      <div className="flex gap-3">
        <div className="h-9 bg-slate-100 rounded-lg flex-1" />
        <div className="h-9 bg-slate-100 rounded-lg flex-1" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl bg-white border border-slate-100 overflow-hidden">
          <div className="h-8 bg-slate-50 border-b border-slate-100" />
          {Array.from({ length: 3 }).map((_, j) => (
            <div key={j} className="flex items-center gap-3 px-4 py-3 border-b border-slate-50">
              <div className="h-8 w-8 rounded-full bg-slate-100 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 bg-slate-100 rounded-full w-32" />
                <div className="h-3 bg-slate-100 rounded-full w-20" />
              </div>
              <div className="h-4 bg-slate-100 rounded-full w-16" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
