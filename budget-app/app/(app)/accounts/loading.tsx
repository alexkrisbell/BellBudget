export default function AccountsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-6 bg-slate-100 rounded-full w-44" />
          <div className="h-4 bg-slate-100 rounded-full w-64" />
        </div>
        <div className="h-9 bg-slate-100 rounded-lg w-36" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-100 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-5 bg-slate-100 rounded-full w-32" />
              <div className="h-5 bg-slate-100 rounded-full w-20" />
            </div>
            {Array.from({ length: 2 }).map((_, j) => (
              <div key={j} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <div className="space-y-1.5">
                  <div className="h-3.5 bg-slate-100 rounded-full w-24" />
                  <div className="h-3 bg-slate-100 rounded-full w-16" />
                </div>
                <div className="h-4 bg-slate-100 rounded-full w-16" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
