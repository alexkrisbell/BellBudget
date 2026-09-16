import Link from 'next/link'
import { Mail } from 'lucide-react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const { email } = await searchParams

  return (
    <Card>
      <CardHeader className="items-center text-center">
        <div className="size-12 rounded-full bg-indigo-50 flex items-center justify-center mb-2">
          <Mail className="h-6 w-6 text-indigo-600" />
        </div>
        <CardTitle>Check your email</CardTitle>
        <CardDescription>
          {email ? (
            <>We sent a confirmation link to <span className="font-medium text-slate-700">{email}</span>.</>
          ) : (
            'We sent you a confirmation link.'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center text-sm text-slate-500">
        Click the link in that email to activate your account, then come back and sign in.
        Don&apos;t see it? Check your spam folder — it&apos;s sent from Supabase on Bell
        Bucks&apos; behalf.
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-sm text-slate-500">
          <Link href="/login" className="text-indigo-600 hover:underline font-medium">
            Back to sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
