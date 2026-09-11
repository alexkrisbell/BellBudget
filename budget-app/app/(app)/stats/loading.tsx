export default function StatsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-1.5">
        <div className="h-6 bg-slate-100 rounded-full w-20" />
        <div className="h-4 bg-slate-100 rounded-full w-56" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-100 bg-white p-4 space-y-2">
            <div className="h-3 bg-slate-100 rounded-full w-16" />
            <div className="h-6 bg-slate-100 rounded-full w-20" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-slate-100 bg-white p-5 h-64" />
      <div className="rounded-xl border border-slate-100 bg-white p-5 h-64" />
    </div>
  )
}
