'use client'

import { FlaskConical } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { ValidationStatus } from './types'

const STATUS_LABELS: Record<ValidationStatus, string> = {
  none: 'Not queued',
  queued: 'Queued',
  confirmed: 'Confirmed',
}

const STATUS_VARIANT: Record<ValidationStatus, string> = {
  none: 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-400',
  queued: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  confirmed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
}

interface ValidationStubProps {
  candidateName: string
  status: ValidationStatus
  onQueue: () => void
}

export function ValidationStub({ candidateName, status, onQueue }: ValidationStubProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" className="flex items-center gap-1.5">
          <FlaskConical className="h-3.5 w-3.5" />
          Send to Validation
          <span className={`ml-1 text-xs px-1.5 py-0.5 rounded ${STATUS_VARIANT[status]}`}>
            {STATUS_LABELS[status]}
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" />
            Lab Validation Workflow
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-4 text-sm text-amber-900 dark:text-amber-100">
            <strong>Phase 5 feature — not yet active.</strong> The full lab validation
            workflow (sample ordering, assay scheduling, and result ingestion) launches
            in a future release. Queuing a candidate here is recorded locally but does
            not trigger any external action.
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Candidate
            </p>
            <p className="text-sm font-medium">{candidateName}</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Current status
            </p>
            <span className={`inline-block text-xs px-2 py-1 rounded font-medium ${STATUS_VARIANT[status]}`}>
              {STATUS_LABELS[status]}
            </span>
          </div>

          <div className="space-y-3 pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              What will happen in Phase 5:
            </p>
            <ol className="text-xs space-y-1 text-muted-foreground list-decimal list-inside">
              <li>Submit candidate to your institutional CRO or in-house lab</li>
              <li>Track assay progress and raw data ingestion</li>
              <li>Promote to confirmed hit when activity is verified</li>
              <li>Compare predicted vs. measured properties</li>
            </ol>
          </div>

          {status === 'none' && (
            <Button className="w-full" onClick={onQueue}>
              Mark as Queued (stub)
            </Button>
          )}
          {status === 'queued' && (
            <p className="text-xs text-center text-muted-foreground">
              This candidate is queued. Lab confirmation will update status to &ldquo;Confirmed&rdquo;.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
