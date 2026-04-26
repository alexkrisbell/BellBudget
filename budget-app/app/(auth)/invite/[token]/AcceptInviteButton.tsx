'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function AcceptInviteButton({ token }: { token: string }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleAccept() {
    startTransition(async () => {
      const res = await fetch('/api/household/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (res.ok) {
        router.push('/dashboard')
      } else {
        const { error } = await res.json()
        alert(error ?? 'Failed to accept invite.')
      }
    })
  }

  return (
    <Button onClick={handleAccept} disabled={pending} className="w-full">
      {pending ? 'Joining…' : 'Accept invite'}
    </Button>
  )
}
