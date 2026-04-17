'use client'

import { useCallback, useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────

type Policy = {
  id: string
  category: 'GREEN' | 'YELLOW' | 'RED'
  autoApprove: boolean
  minAdherenceRate: number
  requireLabReview: boolean
  maxAutoApprovePerSession: number
  description: string | null
  updatedAt: string
}

type CompoundEntry = {
  id: string
  name: string
  category: string
  riskCategory: 'GREEN' | 'YELLOW' | 'RED'
  description: string | null
  mechanism: string | null
}

type AuditEntry = {
  id: string
  sessionId: string
  userId: string
  compoundName: string
  riskCategory: 'GREEN' | 'YELLOW' | 'RED'
  decision: string
  policySnapshot: Record<string, unknown>
  adherenceRate: number | null
  reason: string
  createdAt: string
}

type Tab = 'policies' | 'compounds' | 'audit'

const TIER_STYLES: Record<string, { bg: string; border: string; text: string; label: string }> = {
  GREEN: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', label: 'GREEN' },
  YELLOW: { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-500', text: 'text-amber-700 dark:text-amber-300', label: 'YELLOW' },
  RED: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-500', text: 'text-red-700 dark:text-red-300', label: 'RED' },
}

const DECISION_STYLES: Record<string, { icon: string; text: string }> = {
  AUTO_APPROVED: { icon: '🟢', text: 'text-emerald-600 dark:text-emerald-400' },
  AWAITING_REVIEW: { icon: '🟡', text: 'text-amber-600 dark:text-amber-400' },
  ESCALATED: { icon: '🔴', text: 'text-red-600 dark:text-red-400' },
}

// ─── Policy Editor ─────────────────────────────────────────

function PolicyEditor() {
  const [policies, setPolicies] = useState<Policy[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/governance/policies')
      .then((r) => r.json())
      .then((data: { policies: Policy[] }) => {
        setPolicies(data.policies)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const updatePolicy = async (category: string, field: string, value: unknown) => {
    setSaving(category)
    setFeedback(null)
    try {
      const res = await fetch('/api/admin/governance/policies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, [field]: value }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        setFeedback(err.error ?? 'Update failed')
        return
      }
      const data = (await res.json()) as { policy: Policy }
      setPolicies((prev) => prev.map((p) => (p.category === category ? data.policy : p)))
      setFeedback(`${category} policy updated.`)
    } catch {
      setFeedback('Network error')
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <div className="py-8 text-center text-sm text-muted-foreground">Loading policies...</div>

  return (
    <div className="space-y-4">
      {feedback && (
        <div className="rounded-md bg-muted px-4 py-2 text-sm">{feedback}</div>
      )}

      {policies.map((policy) => {
        const tier = TIER_STYLES[policy.category] ?? TIER_STYLES.GREEN
        const isRed = policy.category === 'RED'

        return (
          <div
            key={policy.id}
            className={cn('rounded-lg border-l-4 p-4', tier.border, tier.bg)}
          >
            <div className="flex items-center justify-between">
              <h3 className={cn('text-sm font-bold uppercase tracking-wider', tier.text)}>
                {tier.label} Tier
              </h3>
              <span className="text-[10px] text-muted-foreground">
                Updated: {new Date(policy.updatedAt).toLocaleDateString()}
              </span>
            </div>

            {policy.description && (
              <p className="mt-1 text-xs text-muted-foreground">{policy.description}</p>
            )}

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium">Auto-Approve</span>
                <select
                  value={policy.autoApprove ? 'true' : 'false'}
                  onChange={(e) => updatePolicy(policy.category, 'autoApprove', e.target.value === 'true')}
                  disabled={isRed || saving === policy.category}
                  className="rounded border bg-background px-2 py-1 text-xs disabled:opacity-50"
                >
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
                {isRed && <span className="text-[10px] text-red-500">Locked</span>}
              </label>

              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium">Min Adherence</span>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={policy.minAdherenceRate}
                  onChange={(e) => updatePolicy(policy.category, 'minAdherenceRate', parseFloat(e.target.value))}
                  disabled={saving === policy.category}
                  className="rounded border bg-background px-2 py-1 text-xs disabled:opacity-50"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium">Require Lab</span>
                <select
                  value={policy.requireLabReview ? 'true' : 'false'}
                  onChange={(e) => updatePolicy(policy.category, 'requireLabReview', e.target.value === 'true')}
                  disabled={saving === policy.category}
                  className="rounded border bg-background px-2 py-1 text-xs disabled:opacity-50"
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium">Max Auto/Session</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={policy.maxAutoApprovePerSession}
                  onChange={(e) => updatePolicy(policy.category, 'maxAutoApprovePerSession', parseInt(e.target.value, 10))}
                  disabled={saving === policy.category}
                  className="rounded border bg-background px-2 py-1 text-xs disabled:opacity-50"
                />
              </label>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Compound Triage ───────────────────────────────────────

function CompoundTriage() {
  const [compounds, setCompounds] = useState<CompoundEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [pendingChanges, setPendingChanges] = useState<Map<string, 'GREEN' | 'YELLOW' | 'RED'>>(new Map())
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const fetchCompounds = useCallback(async (query?: string) => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '100' })
    if (query) params.set('search', query)

    try {
      const res = await fetch(`/api/admin/governance/compounds?${params}`)
      const data = (await res.json()) as { compounds: CompoundEntry[] }
      setCompounds(data.compounds)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCompounds()
  }, [fetchCompounds])

  const handleSearch = () => fetchCompounds(search)

  const stageChange = (id: string, newCategory: 'GREEN' | 'YELLOW' | 'RED') => {
    setPendingChanges((prev) => {
      const next = new Map(prev)
      const original = compounds.find((c) => c.id === id)?.riskCategory
      if (original === newCategory) {
        next.delete(id)
      } else {
        next.set(id, newCategory)
      }
      return next
    })
  }

  const saveChanges = async () => {
    if (pendingChanges.size === 0) return
    setSaving(true)
    setFeedback(null)

    try {
      const updates = Array.from(pendingChanges.entries()).map(([id, riskCategory]) => ({ id, riskCategory }))
      const res = await fetch('/api/admin/governance/compounds', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        setFeedback(err.error ?? 'Update failed')
        return
      }

      const result = (await res.json()) as { updated: number }
      setFeedback(`${result.updated} compound(s) re-categorized.`)
      setPendingChanges(new Map())
      fetchCompounds(search)
    } catch {
      setFeedback('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search compounds..."
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
        />
        <button
          type="button"
          onClick={handleSearch}
          className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
        >
          Search
        </button>
      </div>

      {feedback && (
        <div className="rounded-md bg-muted px-4 py-2 text-sm">{feedback}</div>
      )}

      {/* Save bar */}
      {pendingChanges.size > 0 && (
        <div className="flex items-center justify-between rounded-md border bg-primary/5 px-4 py-2">
          <span className="text-sm">{pendingChanges.size} unsaved change(s)</span>
          <button
            type="button"
            onClick={saveChanges}
            disabled={saving}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save All'}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Compound</th>
              <th className="px-3 py-2 text-left font-medium">Type</th>
              <th className="px-3 py-2 text-left font-medium">Current Tier</th>
              <th className="px-3 py-2 text-left font-medium">Change To</th>
            </tr>
          </thead>
          <tbody>
            {compounds.map((compound) => {
              const currentTier = pendingChanges.get(compound.id) ?? compound.riskCategory
              const tier = TIER_STYLES[currentTier] ?? TIER_STYLES.GREEN
              const hasChange = pendingChanges.has(compound.id)

              return (
                <tr
                  key={compound.id}
                  className={cn(
                    'border-b last:border-0',
                    hasChange && 'bg-primary/5',
                  )}
                >
                  <td className="px-3 py-2">
                    <div className="font-medium">{compound.name}</div>
                    {compound.mechanism && (
                      <div className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{compound.mechanism}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{compound.category}</td>
                  <td className="px-3 py-2">
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', tier.bg, tier.text)}>
                      {currentTier}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={currentTier}
                      onChange={(e) => stageChange(compound.id, e.target.value as 'GREEN' | 'YELLOW' | 'RED')}
                      className="rounded border bg-background px-2 py-1 text-xs"
                    >
                      <option value="GREEN">🟢 GREEN</option>
                      <option value="YELLOW">🟡 YELLOW</option>
                      <option value="RED">🔴 RED</option>
                    </select>
                  </td>
                </tr>
              )
            })}

            {compounds.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                  No compounds found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Audit Log ─────────────────────────────────────────────

function GovernanceAuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [decisionFilter, setDecisionFilter] = useState('')

  const fetchEntries = useCallback(async (decision?: string) => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '50' })
    if (decision) params.set('decision', decision)

    try {
      const res = await fetch(`/api/admin/governance/audit-log?${params}`)
      const data = (await res.json()) as { entries: AuditEntry[] }
      setEntries(data.entries)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEntries(decisionFilter || undefined)
  }, [fetchEntries, decisionFilter])

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex gap-2">
        <select
          value={decisionFilter}
          onChange={(e) => setDecisionFilter(e.target.value)}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">All Decisions</option>
          <option value="AUTO_APPROVED">🟢 Auto-Approved</option>
          <option value="AWAITING_REVIEW">🟡 Awaiting Review</option>
          <option value="ESCALATED">🔴 Escalated</option>
        </select>
      </div>

      {/* Entries */}
      <div className="space-y-2">
        {entries.map((entry) => {
          const decision = DECISION_STYLES[entry.decision] ?? DECISION_STYLES.AWAITING_REVIEW
          const tier = TIER_STYLES[entry.riskCategory] ?? TIER_STYLES.GREEN

          return (
            <div
              key={entry.id}
              className="flex items-start gap-3 rounded-lg border p-3"
            >
              <span className="mt-0.5 text-base">{decision.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn('text-sm font-medium', decision.text)}>
                    {entry.compoundName}
                  </span>
                  <span className={cn('rounded-full px-1.5 py-px text-[9px] font-bold uppercase', tier.bg, tier.text)}>
                    {entry.riskCategory}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{entry.reason}</p>
                <div className="mt-1 flex gap-3 text-[10px] text-muted-foreground">
                  <span>Session: {entry.sessionId.slice(0, 8)}...</span>
                  {entry.adherenceRate !== null && (
                    <span>Adherence: {Math.round(entry.adherenceRate * 100)}%</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {entries.length === 0 && !loading && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No governance decisions recorded yet.
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Dashboard ────────────────────────────────────────

export function GovernanceDashboard({ className }: { className?: string }) {
  const [activeTab, setActiveTab] = useState<Tab>('policies')

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'policies', label: 'Policy Editor', icon: '⚙️' },
    { key: 'compounds', label: 'Compound Triage', icon: '🧪' },
    { key: 'audit', label: 'Override Logs', icon: '📋' },
  ]

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div>
        <h1 className="text-xl font-bold">Clinical Governance</h1>
        <p className="text-sm text-muted-foreground">
          Configure traffic-light tiering policies, re-categorize compounds, and review auto-approval decisions.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span className="mr-1.5">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'policies' && <PolicyEditor />}
      {activeTab === 'compounds' && <CompoundTriage />}
      {activeTab === 'audit' && <GovernanceAuditLog />}
    </div>
  )
}
