'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Props {
  isLastMember: boolean
  householdName: string
}

const CONFIRM_TEXT = 'DELETE'

function DeleteConfirmForm({ isLastMember, householdName, onOpenChange }: Props & {
  onOpenChange: (open: boolean) => void
}) {
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to delete account.')
      window.location.href = '/'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account.')
      setDeleting(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Delete your account?</DialogTitle>
      </DialogHeader>

      {isLastMember ? (
        <p className="text-sm text-slate-600">
          You&apos;re the only member of <span className="font-medium">{householdName}</span>.
          This will permanently delete your household and everything in it — connected
          accounts, transactions, budgets, and history. This can&apos;t be undone.
        </p>
      ) : (
        <p className="text-sm text-slate-600">
          You&apos;ll be removed from <span className="font-medium">{householdName}</span>.
          The household and its data stay intact for the other member(s) — only your own
          account is deleted. This can&apos;t be undone.
        </p>
      )}

      <div className="space-y-1.5">
        <label className="text-xs text-slate-500">
          Type <span className="font-mono font-semibold">{CONFIRM_TEXT}</span> to confirm
        </label>
        <Input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          autoFocus
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          onClick={handleDelete}
          disabled={deleting || confirmText !== CONFIRM_TEXT}
        >
          {deleting ? 'Deleting…' : 'Delete account'}
        </Button>
      </DialogFooter>
    </>
  )
}

export function DeleteAccountCard({ isLastMember, householdName }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-xl border border-red-200 bg-red-50/50 p-5">
      <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">
        Danger Zone
      </p>
      <p className="text-sm text-slate-600 mb-4">
        Permanently delete your account and sign out. This cannot be undone.
      </p>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Delete Account
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          {open && (
            <DeleteConfirmForm
              isLastMember={isLastMember}
              householdName={householdName}
              onOpenChange={setOpen}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
