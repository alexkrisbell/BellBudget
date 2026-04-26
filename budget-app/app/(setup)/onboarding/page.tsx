'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

type Tab = 'create' | 'join'

export default function OnboardingPage() {
  const [tab, setTab] = useState<Tab>('create')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const name = fd.get('name') as string
    setError(null)
    startTransition(async () => {
      const res = await fetch('/api/household', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (res.ok) {
        router.push('/dashboard')
      } else {
        const { error } = await res.json()
        setError(error ?? 'Failed to create household.')
      }
    })
  }

  function handleJoin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const token = (fd.get('token') as string).trim()
    setError(null)
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
        setError(error ?? 'Invalid or expired invite.')
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome!</CardTitle>
        <CardDescription>Create a new household or join an existing one.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex rounded-lg border border-slate-200 p-1 gap-1">
          <button
            type="button"
            onClick={() => { setTab('create'); setError(null) }}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              tab === 'create'
                ? 'bg-white shadow-sm text-slate-900'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Create household
          </button>
          <button
            type="button"
            onClick={() => { setTab('join'); setError(null) }}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              tab === 'join'
                ? 'bg-white shadow-sm text-slate-900'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Join with invite
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        {tab === 'create' ? (
          <form id="create-form" onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Household name</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g. Smith Family"
                required
              />
            </div>
          </form>
        ) : (
          <form id="join-form" onSubmit={handleJoin} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="token">Invite code or link</Label>
              <Input
                id="token"
                name="token"
                placeholder="Paste invite token here"
                required
              />
            </div>
          </form>
        )}
      </CardContent>
      <CardFooter>
        <Button
          type="submit"
          form={tab === 'create' ? 'create-form' : 'join-form'}
          className="w-full"
          disabled={pending}
        >
          {pending
            ? tab === 'create' ? 'Creating…' : 'Joining…'
            : tab === 'create' ? 'Create household' : 'Join household'}
        </Button>
      </CardFooter>
    </Card>
  )
}
