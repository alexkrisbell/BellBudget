export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Budget App</h1>
          <p className="text-sm text-slate-500 mt-1">Track your household finances</p>
        </div>
        {children}
      </div>
    </div>
  )
}
