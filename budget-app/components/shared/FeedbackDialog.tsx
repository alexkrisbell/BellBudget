'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Mounted only while open, so its form state resets fresh each time it opens
// — same pattern as SplitDialog.
function FeedbackForm({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const pathname = usePathname()
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSend() {
    if (!message.trim()) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, page_path: pathname }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to send feedback.')
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send feedback.')
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Thanks!</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-500">
          Your feedback has been sent. We read every one of these.
        </p>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </>
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Send feedback</DialogTitle>
        <p className="text-sm text-slate-500">
          Found a bug, or have an idea? Let us know.
        </p>
      </DialogHeader>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="What's on your mind?"
        rows={5}
        autoFocus
        className="w-full min-h-24 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />

      {error && <p className="text-xs text-red-600">{error}</p>}

      <DialogFooter>
        <Button onClick={handleSend} disabled={sending || !message.trim()}>
          {sending ? 'Sending…' : 'Send'}
        </Button>
      </DialogFooter>
    </>
  )
}

export function FeedbackDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && <FeedbackForm onOpenChange={onOpenChange} />}
      </DialogContent>
    </Dialog>
  )
}
