export default function DashboardLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-6 bg-slate-100 rounded-full w-40" />
      <div className="flex justify-between items-center">
        <div className="h-8 bg-slate-100 rounded-full w-36" />
        <div className="h-8 bg-slate-100 rounded-lg w-32" />
      </div>
      <div className="h-28 bg-slate-100 rounded-xl" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 bg-slate-100 rounded-xl" />
        ))}
      </div>
      <div className="h-20 bg-slate-100 rounded-xl" />
      <div className="h-40 bg-slate-100 rounded-xl" />
    </div>
  )
}
