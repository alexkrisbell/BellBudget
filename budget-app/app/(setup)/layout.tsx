import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function SetupLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Bell Bucks</h1>
          <p className="text-sm text-slate-500 mt-1">Let&apos;s get you set up</p>
        </div>
        {children}
      </div>
    </div>
  )
}
