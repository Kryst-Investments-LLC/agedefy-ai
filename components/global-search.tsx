"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, X, FlaskConical, BookOpen, Users, GitBranch } from "lucide-react"

interface SearchResult {
  id: string
  name?: string
  title?: string
  slug?: string
  category?: string
  topic?: string
  summary?: string
  mechanism?: string
  description?: string
  type: "compound" | "article" | "post" | "pathway"
  href: string
}

interface SearchResponse {
  compounds: SearchResult[]
  articles: SearchResult[]
  posts: SearchResult[]
  pathways: SearchResult[]
  total: number
}

const typeIcon = {
  compound: FlaskConical,
  article: BookOpen,
  post: Users,
  pathway: GitBranch,
}

const typeLabel = {
  compound: "Compound",
  article: "Article",
  post: "Discussion",
  pathway: "Pathway",
}

export function GlobalSearch() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResponse | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(null); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=5`)
      if (res.ok) {
        const data: SearchResponse = await res.json()
        setResults(data)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => search(query), 300)
    return () => clearTimeout(t)
  }, [query, search])

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const allResults: SearchResult[] = results
    ? [...results.compounds, ...results.articles, ...results.pathways, ...results.posts]
    : []

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search compounds, articles, pathways…"
          className="pl-9 pr-8 h-9 w-64 bg-gray-800 border-gray-700 text-sm"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setResults(null); setOpen(false) }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-md border bg-gray-900 shadow-lg max-h-96 overflow-y-auto">
          {loading && (
            <p className="px-3 py-4 text-sm text-muted-foreground">Searching…</p>
          )}
          {!loading && allResults.length === 0 && (
            <p className="px-3 py-4 text-sm text-muted-foreground">No results for &quot;{query}&quot;</p>
          )}
          {!loading && allResults.length > 0 && (
            <ul className="divide-y divide-gray-800">
              {allResults.map((r) => {
                const Icon = typeIcon[r.type]
                return (
                  <li key={`${r.type}-${r.id}`}>
                    <Link
                      href={r.href}
                      onClick={() => { setOpen(false); setQuery("") }}
                      className="flex items-start gap-3 px-3 py-3 hover:bg-gray-800 transition-colors"
                    >
                      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{r.name ?? r.title}</span>
                          <Badge variant="outline" className="text-[10px] shrink-0">{typeLabel[r.type]}</Badge>
                        </div>
                        {(r.summary || r.mechanism || r.description) && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {r.summary ?? r.mechanism ?? r.description}
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
