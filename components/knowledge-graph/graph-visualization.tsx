"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Search, ZoomIn, ZoomOut } from "lucide-react"

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface GraphNode {
  id: string
  label: string
  type: "compound" | "pathway" | "biomarker" | "study"
  x: number
  y: number
  vx: number
  vy: number
}

interface GraphEdge {
  source: string
  target: string
  label: string
  type:
    | "pathway-link"
    | "interaction"
    | "biomarker-effect"
    | "study-link"
}

interface CompoundGraph {
  id: string
  name: string
  category: string
  pathways?: Array<{ pathway: { id: string; name: string }; effect: string }>
  interactions?: Array<{
    compoundB: { id: string; name: string }
    severity: string
  }>
  interactedWith?: Array<{
    compoundA: { id: string; name: string }
    severity: string
  }>
  biomarkerEffects?: Array<{
    id: string
    biomarkerName: string
    direction: string
  }>
  studyLinks?: Array<{
    id: string
    title: string
    url: string
  }>
}

/* ------------------------------------------------------------------ */
/* Colour helpers                                                     */
/* ------------------------------------------------------------------ */

const NODE_COLORS: Record<GraphNode["type"], string> = {
  compound: "#3b82f6",
  pathway: "#10b981",
  biomarker: "#f59e0b",
  study: "#8b5cf6",
}

const EDGE_COLORS: Record<GraphEdge["type"], string> = {
  "pathway-link": "#10b981",
  interaction: "#ef4444",
  "biomarker-effect": "#f59e0b",
  "study-link": "#8b5cf6",
}

/* ------------------------------------------------------------------ */
/* Convert API response → graph nodes & edges                         */
/* ------------------------------------------------------------------ */

function buildGraph(data: CompoundGraph): {
  nodes: GraphNode[]
  edges: GraphEdge[]
} {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const seen = new Set<string>()

  function addNode(id: string, label: string, type: GraphNode["type"]) {
    if (seen.has(id)) return
    seen.add(id)
    // Random initial positions — force layout will settle them
    nodes.push({
      id,
      label,
      type,
      x: Math.random() * 600 - 300,
      y: Math.random() * 600 - 300,
      vx: 0,
      vy: 0,
    })
  }

  // Centre compound
  addNode(data.id, data.name, "compound")

  // Pathways
  for (const pw of data.pathways ?? []) {
    addNode(pw.pathway.id, pw.pathway.name, "pathway")
    edges.push({
      source: data.id,
      target: pw.pathway.id,
      label: pw.effect,
      type: "pathway-link",
    })
  }

  // Interactions
  for (const ix of data.interactions ?? []) {
    addNode(ix.compoundB.id, ix.compoundB.name, "compound")
    edges.push({
      source: data.id,
      target: ix.compoundB.id,
      label: ix.severity,
      type: "interaction",
    })
  }
  for (const ix of data.interactedWith ?? []) {
    addNode(ix.compoundA.id, ix.compoundA.name, "compound")
    edges.push({
      source: ix.compoundA.id,
      target: data.id,
      label: ix.severity,
      type: "interaction",
    })
  }

  // Biomarker effects
  for (const be of data.biomarkerEffects ?? []) {
    addNode(be.id, be.biomarkerName, "biomarker")
    edges.push({
      source: data.id,
      target: be.id,
      label: be.direction,
      type: "biomarker-effect",
    })
  }

  // Study links
  for (const sl of data.studyLinks ?? []) {
    addNode(sl.id, sl.title.slice(0, 30), "study")
    edges.push({
      source: data.id,
      target: sl.id,
      label: "study",
      type: "study-link",
    })
  }

  return { nodes, edges }
}

/* ------------------------------------------------------------------ */
/* Simple force-directed layout (canvas-based)                        */
/* ------------------------------------------------------------------ */

function applyForces(nodes: GraphNode[], edges: GraphEdge[]) {
  const repulsion = 3000
  const attraction = 0.005
  const damping = 0.85

  // Repulsion between all node pairs
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x
      const dy = nodes[i].y - nodes[j].y
      const distSq = dx * dx + dy * dy + 1
      const force = repulsion / distSq
      const fx = (dx / Math.sqrt(distSq)) * force
      const fy = (dy / Math.sqrt(distSq)) * force
      nodes[i].vx += fx
      nodes[i].vy += fy
      nodes[j].vx -= fx
      nodes[j].vy -= fy
    }
  }

  // Attraction along edges
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  for (const edge of edges) {
    const s = nodeMap.get(edge.source)
    const t = nodeMap.get(edge.target)
    if (!s || !t) continue
    const dx = t.x - s.x
    const dy = t.y - s.y
    s.vx += dx * attraction
    s.vy += dy * attraction
    t.vx -= dx * attraction
    t.vy -= dy * attraction
  }

  // Apply velocity + damping
  for (const node of nodes) {
    node.vx *= damping
    node.vy *= damping
    node.x += node.vx
    node.y += node.vy
  }
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export function KnowledgeGraphVisualization() {
  const [, setCompoundId] = useState("")
  const [search, setSearch] = useState("")
  const [graphData, setGraphData] = useState<{
    nodes: GraphNode[]
    edges: GraphEdge[]
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  const loadGraph = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/knowledge-graph?compound=${encodeURIComponent(id)}`,
      )
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Failed to load graph")
        return
      }
      const data: CompoundGraph = await res.json()
      setGraphData(buildGraph(data))
    } catch {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }, [])

  // Force-directed animation
  useEffect(() => {
    if (!graphData || graphData.nodes.length === 0) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let running = true
    const nodes = graphData.nodes.map((n) => ({ ...n }))
    const edges = graphData.edges

    function draw() {
      if (!ctx || !canvas || !running) return

      applyForces(nodes, edges)

      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)
      ctx.save()
      ctx.translate(w / 2, h / 2)
      ctx.scale(zoom, zoom)

      const nodeMap = new Map(nodes.map((n) => [n.id, n]))

      // Draw edges
      for (const edge of edges) {
        const s = nodeMap.get(edge.source)
        const t = nodeMap.get(edge.target)
        if (!s || !t) continue
        ctx.beginPath()
        ctx.moveTo(s.x, s.y)
        ctx.lineTo(t.x, t.y)
        ctx.strokeStyle = EDGE_COLORS[edge.type] ?? "#94a3b8"
        ctx.lineWidth = 1.5
        ctx.stroke()

        // Edge label
        ctx.fillStyle = "#64748b"
        ctx.font = "9px sans-serif"
        ctx.textAlign = "center"
        ctx.fillText(edge.label, (s.x + t.x) / 2, (s.y + t.y) / 2 - 4)
      }

      // Draw nodes
      for (const node of nodes) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, 8, 0, Math.PI * 2)
        ctx.fillStyle = NODE_COLORS[node.type] ?? "#94a3b8"
        ctx.fill()
        ctx.strokeStyle = "#fff"
        ctx.lineWidth = 2
        ctx.stroke()

        ctx.fillStyle = "#1e293b"
        ctx.font = "11px sans-serif"
        ctx.textAlign = "center"
        ctx.fillText(node.label, node.x, node.y + 18)
      }

      ctx.restore()
      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => {
      running = false
      cancelAnimationFrame(animRef.current)
    }
  }, [graphData, zoom])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (search.trim()) {
      setCompoundId(search.trim())
      loadGraph(search.trim())
    }
  }

  return (
    <div className="rounded-xl border bg-white shadow-sm dark:bg-gray-900 dark:border-gray-800">
      {/* Search bar */}
      <div className="border-b p-4 dark:border-gray-800">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Enter compound ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !search.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Explore"
            )}
          </button>
        </form>

        {error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>

      {/* Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={800}
          height={500}
          className="w-full"
          style={{ maxHeight: 500 }}
        />

        {/* Zoom controls */}
        {graphData && (
          <div className="absolute bottom-3 right-3 flex gap-1">
            <button
              onClick={() => setZoom((z) => Math.min(z + 0.2, 3))}
              className="rounded-md bg-white p-1.5 shadow border dark:bg-gray-800 dark:border-gray-700"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(z - 0.2, 0.3))}
              className="rounded-md bg-white p-1.5 shadow border dark:bg-gray-800 dark:border-gray-700"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Legend */}
        {graphData && (
          <div className="absolute top-3 left-3 rounded-lg bg-white/90 p-2 text-xs shadow dark:bg-gray-900/90">
            <div className="flex items-center gap-1 mb-1">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: NODE_COLORS.compound }}
              />
              Compound
            </div>
            <div className="flex items-center gap-1 mb-1">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: NODE_COLORS.pathway }}
              />
              Pathway
            </div>
            <div className="flex items-center gap-1 mb-1">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: NODE_COLORS.biomarker }}
              />
              Biomarker
            </div>
            <div className="flex items-center gap-1">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: NODE_COLORS.study }}
              />
              Study
            </div>
          </div>
        )}

        {/* Empty state */}
        {!graphData && !loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Search for a compound to visualize its knowledge graph
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
