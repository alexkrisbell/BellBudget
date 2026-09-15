export default function BillsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-1.5">
        <div className="h-6 bg-slate-100 rounded-full w-40" />
        <div className="h-4 bg-slate-100 rounded-full w-72" />
      </div>
      <div className="rounded-xl border border-slate-100 bg-white p-4 space-y-2">
        <div className="h-3 bg-slate-100 rounded-full w-32" />
        <div className="h-6 bg-slate-100 rounded-full w-24" />
      </div>
      <div className="rounded-xl bg-white border border-slate-100 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-50 last:border-0">
            <div className="h-9 w-9 rounded-full bg-slate-100 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 bg-slate-100 rounded-full w-32" />
              <div className="h-3 bg-slate-100 rounded-full w-24" />
            </div>
            <div className="h-4 bg-slate-100 rounded-full w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}
