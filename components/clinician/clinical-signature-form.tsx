'use client'

import { useCallback, useState } from 'react'

import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

type ClinicalSignatureFormProps = {
  redTierItemIds: string[]
  allItemIds: string[]
  onSigned: (result: { updated: number; signatureCount: number }) => void
  onCancel: () => void
}

export function ClinicalSignatureForm({
  redTierItemIds,
  allItemIds,
  onSigned,
  onCancel,
}: ClinicalSignatureFormProps) {
  const [rationale, setRationale] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<{
    signedAt: string
    signatureCount: number
    updated: number
  } | null>(null)

  const isValid = rationale.trim().length >= 10 && confirmed

  const handleSubmit = useCallback(async () => {
    if (!isValid || submitting) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/clinician/review-queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: allItemIds,
          action: 'resolve',
          rationale: rationale.trim(),
        }),
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? 'Signature failed')
      }

      const result = (await res.json()) as { updated: number; signatureCount: number }

      // Show receipt before notifying parent
      setReceipt({
        signedAt: new Date().toISOString(),
        signatureCount: result.signatureCount,
        updated: result.updated,
      })

      // Notify parent after a short delay so clinician can see receipt
      setTimeout(() => onSigned(result), 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign')
    } finally {
      setSubmitting(false)
    }
  }, [isValid, submitting, allItemIds, rationale, onSigned])

  // Receipt view — shown after successful signing
  if (receipt) {
    return (
      <div className="rounded-lg border bg-card shadow-lg">
        <div className="border-b bg-emerald-50 px-6 py-4 dark:bg-emerald-900/20">
          <div className="flex items-center gap-2">
            <span className="text-lg">✅</span>
            <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              Signature Recorded
            </h3>
          </div>
        </div>
        <div className="space-y-4 p-6">
          <div className="rounded-md border bg-muted/30 px-4 py-4 space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Signature Receipt
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Signed At (UTC)</span>
                <span className="font-mono">{new Date(receipt.signedAt).toISOString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Items Approved</span>
                <span className="font-mono">{receipt.updated}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Signatures Created</span>
                <span className="font-mono">{receipt.signatureCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">RED-Tier Items</span>
                <span className="font-mono">{redTierItemIds.length}</span>
              </div>
            </div>
            <p className="mt-3 text-[10px] text-muted-foreground">
              This receipt confirms your clinical signature has been
              cryptographically recorded. The SHA-256 hash will appear on the
              patient&apos;s Physician Summary report. You can view your full
              signature history from the clinician dashboard.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card shadow-lg">
      {/* Header */}
      <div className="border-b bg-red-50 px-6 py-4 dark:bg-red-900/20">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔴</span>
          <h3 className="text-sm font-bold uppercase tracking-wider text-red-700 dark:text-red-300">
            Clinical Signature Required
          </h3>
        </div>
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
          {redTierItemIds.length} RED-tier item{redTierItemIds.length !== 1 ? 's' : ''} require
          your clinical rationale and digital signature before the patient is notified.
        </p>
      </div>

      {/* Body */}
      <div className="space-y-4 p-6">
        {/* Rationale */}
        <div>
          <label htmlFor="sig-rationale" className="block text-sm font-medium">
            Clinical Rationale
          </label>
          <p className="mb-2 text-xs text-muted-foreground">
            Explain why you are approving this high-risk recommendation.
            This rationale will appear on the Physician Summary report.
          </p>
          <textarea
            id="sig-rationale"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="e.g., Patient's inflammatory markers have remained elevated despite 8 weeks of standard supplementation. BPC-157 is appropriate given the absence of contraindications and the patient's informed consent..."
            rows={4}
            maxLength={2000}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>{rationale.trim().length < 10 ? `${10 - rationale.trim().length} more characters required` : 'Sufficient'}</span>
            <span>{rationale.length}/2000</span>
          </div>
        </div>

        {/* Confirmation */}
        <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
          <Checkbox
            checked={confirmed}
            onCheckedChange={(checked) => setConfirmed(checked === true)}
            className="mt-0.5"
            id="sig-confirm"
            aria-label="I confirm that I am a licensed healthcare provider"
          />
          <span className="text-xs leading-relaxed text-muted-foreground">
            I confirm that I am a licensed healthcare provider, I have reviewed
            the patient&apos;s biomarker data and safety analysis, and I approve
            this recommendation with full clinical responsibility. My digital
            signature will be cryptographically recorded and appended to the
            patient&apos;s Physician Summary report.
          </span>
        </label>

        {/* Signature preview */}
        <div className="rounded-md border bg-muted/30 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Signature Preview
          </div>
          <div className="mt-2 space-y-1 text-xs">
            <div className="font-mono text-muted-foreground">
              SHA-256( clinician_id | review_items | rationale | timestamp )
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Witness Timestamp (UTC)</span>
              <span className="font-mono">{new Date().toISOString()}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>RED-Tier Items</span>
              <span className="font-mono">{redTierItemIds.length}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 px-4 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-md border px-4 py-2 text-sm text-muted-foreground hover:bg-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className={cn(
              'rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50',
              isValid ? 'bg-red-600 hover:bg-red-700' : 'bg-muted',
            )}
          >
            {submitting ? 'Signing...' : 'Sign & Approve'}
          </button>
        </div>
      </div>
    </div>
  )
}
