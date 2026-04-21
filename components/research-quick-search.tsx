"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"

/**
 * Quick PubMed ingest form for the research page. Submits to /api/research/ingest
 * which creates a new ResearchCollection populated with PubMed search results.
 */
export function ResearchQuickSearch() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [collectionName, setCollectionName] = useState("")
  const [maxResults, setMaxResults] = useState(10)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setResult(null)
    if (query.trim().length < 3) {
      setError("Search query must be at least 3 characters.")
      return
    }
    if (collectionName.trim().length < 3) {
      setError("Collection name must be at least 3 characters.")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/research/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collectionName: collectionName.trim(),
          query: query.trim(),
          maxResults,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(typeof body?.error === "string" ? body.error : `Ingest failed (${res.status})`)
      }
      const data = await res.json().catch(() => null)
      setResult(
        data?.message ?? `Ingest scheduled. Refresh to see your new collection in the list below.`,
      )
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ingest failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-gray-800 bg-gray-950 p-6 space-y-4"
    >
      <div>
        <h2 className="text-xl font-semibold">Run a PubMed search</h2>
        <p className="mt-1 text-sm text-gray-400">
          Enter a topic or PubMed query (supports MeSH and field tags). Results are persisted as a
          new collection you can revisit, share, and feed into Bio-Agent prompts.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="block text-gray-300">Collection name</span>
          <input
            value={collectionName}
            onChange={(e) => setCollectionName(e.target.value)}
            placeholder="e.g. Senolytics 2024"
            className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white"
            maxLength={100}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="block text-gray-300">Max results (1–50)</span>
          <input
            type="number"
            min={1}
            max={50}
            value={maxResults}
            onChange={(e) => setMaxResults(Math.min(50, Math.max(1, Number.parseInt(e.target.value, 10) || 10)))}
            className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white"
          />
        </label>
      </div>

      <label className="block space-y-1 text-sm">
        <span className="block text-gray-300">Search query</span>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={3}
          placeholder='e.g. "rapamycin AND lifespan AND mice" or "NMN[Title] AND clinical trial"'
          className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white"
          maxLength={500}
        />
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {result && <p className="text-sm text-emerald-400">{result}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting} className="bg-teal-600 hover:bg-teal-700">
          {submitting ? "Ingesting…" : "Run PubMed search"}
        </Button>
        <span className="text-xs text-gray-500">
          Tip: combine terms with AND/OR/NOT; use field tags like <code>[Title]</code>, <code>[Author]</code>.
        </span>
      </div>
    </form>
  )
}
