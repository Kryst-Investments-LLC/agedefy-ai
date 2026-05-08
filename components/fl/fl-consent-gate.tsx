/**
 * Federated Learning — Consent Gate Component
 *
 * Explains what FL is, what stays local vs what is shared,
 * and checks whether the user has granted `research-usage` consent.
 *
 * @module components/fl/fl-consent-gate
 */

'use client'

import { useState, useEffect, type ReactNode } from 'react'

interface FLConsentGateProps {
  children: ReactNode
}

interface ConsentStatus {
  hasConsent: boolean
  loading: boolean
}

export function FLConsentGate({ children }: FLConsentGateProps) {
  const [status, setStatus] = useState<ConsentStatus>({ hasConsent: false, loading: true })

  useEffect(() => {
    async function checkConsent() {
      try {
        const res = await fetch('/api/fl/participate')
        if (res.ok) {
          setStatus({ hasConsent: true, loading: false })
        } else if (res.status === 403) {
          setStatus({ hasConsent: false, loading: false })
        } else if (res.status === 401) {
          setStatus({ hasConsent: false, loading: false })
        } else {
          setStatus({ hasConsent: false, loading: false })
        }
      } catch {
        setStatus({ hasConsent: false, loading: false })
      }
    }
    checkConsent()
  }, [])

  if (status.loading) {
    return (
      <div className="rounded-2xl border border-gray-800 bg-gray-950 p-8 text-center">
        <p className="text-gray-400">Checking consent status…</p>
      </div>
    )
  }

  if (!status.hasConsent) {
    return (
      <div className="rounded-2xl border border-amber-800/50 bg-amber-950/20 p-8">
        <h3 className="text-xl font-semibold text-amber-300">
          Research Consent Required
        </h3>
        <p className="mt-3 max-w-2xl text-sm text-gray-300">
          Federated Learning lets Biozephyra improve its models using insights
          from your health data — <strong>without your raw data ever leaving your device</strong>.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-green-800/50 bg-green-950/20 p-4">
            <p className="text-sm font-medium text-green-400">✓ What stays on your device</p>
            <ul className="mt-2 space-y-1 text-xs text-gray-400">
              <li>• Your raw biomarker values</li>
              <li>• Your personal health records</li>
              <li>• Your identity and demographics</li>
              <li>• Your protocol details</li>
            </ul>
          </div>

          <div className="rounded-xl border border-blue-800/50 bg-blue-950/20 p-4">
            <p className="text-sm font-medium text-blue-400">↑ What is shared (encrypted)</p>
            <ul className="mt-2 space-y-1 text-xs text-gray-400">
              <li>• Model gradients (math derivatives, not data)</li>
              <li>• Protected with differential privacy noise</li>
              <li>• Secured via encrypted aggregation</li>
              <li>• Cannot be reversed to reveal your data</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-4">
          <a
            href="/account/consent"
            className="inline-flex items-center rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-500 transition-colors"
          >
            Grant Research Consent
          </a>
          <a
            href="/docs/federated-learning"
            className="text-sm text-gray-400 underline hover:text-gray-300"
          >
            Learn more about FL privacy
          </a>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
