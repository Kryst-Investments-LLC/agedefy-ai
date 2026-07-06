'use client'

/**
 * The closed measurement loop.
 *
 * Biozephyra's durable value isn't a biomarker dashboard — it's the loop:
 * measure → recommend → act → re-measure → see the effect → repeat. This
 * component makes that loop legible and shows the user exactly where they are
 * in it, with a single CTA for the next step. Stage completion is derived from
 * real data on the server.
 */

import Link from 'next/link'
import { Check, ArrowRight, RefreshCw } from 'lucide-react'

export interface LoopStage {
  key: string
  label: string
  hint: string
  done: boolean
  href: string
  cta: string
}

export function MeasurementLoop({ stages }: { stages: LoopStage[] }) {
  const currentIdx = stages.findIndex((s) => !s.done)
  const complete = currentIdx === -1
  const current = complete ? null : stages[currentIdx]

  return (
    <section className="rounded-2xl border bg-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <RefreshCw className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Your measurement loop</h2>
        <span className="ml-auto text-xs text-muted-foreground">
          {stages.filter((s) => s.done).length}/{stages.length} stages
        </span>
      </div>

      {/* stepper */}
      <ol className="flex items-stretch gap-1 overflow-x-auto pb-1">
        {stages.map((s, i) => {
          const isCurrent = i === currentIdx
          return (
            <li key={s.key} className="flex min-w-[110px] flex-1 flex-col items-center text-center">
              <div className="flex w-full items-center">
                <span className={`h-0.5 flex-1 ${i === 0 ? 'bg-transparent' : s.done || isCurrent ? 'bg-teal-600 dark:bg-teal-400' : 'bg-border'}`} />
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold ${
                    s.done
                      ? 'border-teal-600 bg-teal-600 text-white dark:border-teal-400 dark:bg-teal-400 dark:text-background'
                      : isCurrent
                        ? 'border-teal-600 text-teal-600 dark:border-teal-400 dark:text-teal-400'
                        : 'border-border text-muted-foreground'
                  }`}
                >
                  {s.done ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span className={`h-0.5 flex-1 ${i === stages.length - 1 ? 'bg-transparent' : s.done ? 'bg-teal-600 dark:bg-teal-400' : 'bg-border'}`} />
              </div>
              <p className={`mt-2 text-xs font-medium ${s.done || isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>
                {s.label}
              </p>
              <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{s.hint}</p>
            </li>
          )
        })}
      </ol>

      {/* next action */}
      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border bg-background/50 p-3">
        {complete ? (
          <>
            <p className="text-sm">
              <span className="font-medium text-teal-600 dark:text-teal-400">Loop closed.</span>{' '}
              Re-measure on your next panel to track the effect over time.
            </p>
            <Link href="/bio-age" className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              View trend <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm">
              <span className="text-muted-foreground">Next:</span>{' '}
              <span className="font-medium">{current!.cta}</span>
            </p>
            <Link
              href={current!.href}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        )}
      </div>
    </section>
  )
}
