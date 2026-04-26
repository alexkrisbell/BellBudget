export default function BudgetLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex justify-between items-start">
        <div className="space-y-1.5">
          <div className="h-6 bg-slate-100 rounded-full w-24" />
          <div className="h-4 bg-slate-100 rounded-full w-48" />
        </div>
        <div className="h-9 bg-slate-100 rounded-lg w-44" />
      </div>
      <div className="rounded-xl border border-slate-100 bg-white p-5 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-8 w-8 rounded-full bg-slate-100 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 bg-slate-100 rounded-full w-28" />
              <div className="h-2 bg-slate-100 rounded-full w-full" />
            </div>
            <div className="h-4 bg-slate-100 rounded-full w-16 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
