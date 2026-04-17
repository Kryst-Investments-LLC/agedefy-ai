'use client'

import { useEffect, useRef } from 'react'

import { cn } from '@/lib/utils'

type GraphNode = {
  id: string
  name: string
  x: number
  y: number
  vx: number
  vy: number
}

type GraphEdge = {
  source: string
  target: string
  severity: string
}

type InteractionGraphProps = {
  compounds: { id: string; name: string }[]
  interactions: {
    severity: string
    compoundA?: { id: string; name: string }
    compoundB?: { id: string; name: string }
  }[]
  className?: string
}

const SEVERITY_COLORS: Record<string, string> = {
  BENEFICIAL: '#22c55e',
  NEUTRAL: '#6b7280',
  CAUTION: '#eab308',
  DANGEROUS: '#ef4444',
  UNKNOWN: '#6b7280',
}

const NODE_RADIUS = 28
const CANVAS_PADDING = 60

export function InteractionGraph({
  compounds,
  interactions,
  className,
}: InteractionGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nodesRef = useRef<GraphNode[]>([])
  const edgesRef = useRef<GraphEdge[]>([])
  const animRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    const W = rect.width
    const H = rect.height

    // Initialize nodes in a circle
    const cx = W / 2
    const cy = H / 2
    const radius = Math.min(W, H) / 2 - CANVAS_PADDING
    nodesRef.current = compounds.map((c, i) => {
      const angle = (2 * Math.PI * i) / compounds.length - Math.PI / 2
      return {
        id: c.id,
        name: c.name,
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
        vx: 0,
        vy: 0,
      }
    })

    // Build edges
    edgesRef.current = interactions
      .filter((ix) => ix.compoundA && ix.compoundB)
      .map((ix) => ({
        source: ix.compoundA!.id,
        target: ix.compoundB!.id,
        severity: ix.severity,
      }))

    const nodeMap = new Map(nodesRef.current.map((n) => [n.id, n]))

    function simulate() {
      const nodes = nodesRef.current
      const damping = 0.85

      // Repulsion between all nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x
          const dy = nodes[j].y - nodes[i].y
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
          const force = 2000 / (dist * dist)
          const fx = (dx / dist) * force
          const fy = (dy / dist) * force
          nodes[i].vx -= fx
          nodes[i].vy -= fy
          nodes[j].vx += fx
          nodes[j].vy += fy
        }
      }

      // Attraction along edges
      for (const edge of edgesRef.current) {
        const a = nodeMap.get(edge.source)
        const b = nodeMap.get(edge.target)
        if (!a || !b) continue
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
        const ideal = 140
        const force = (dist - ideal) * 0.01
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        a.vx += fx
        a.vy += fy
        b.vx -= fx
        b.vy -= fy
      }

      // Center gravity
      for (const node of nodes) {
        node.vx += (cx - node.x) * 0.002
        node.vy += (cy - node.y) * 0.002
      }

      // Apply velocities
      for (const node of nodes) {
        node.vx *= damping
        node.vy *= damping
        node.x += node.vx
        node.y += node.vy
        // Clamp to canvas
        node.x = Math.max(CANVAS_PADDING, Math.min(W - CANVAS_PADDING, node.x))
        node.y = Math.max(CANVAS_PADDING, Math.min(H - CANVAS_PADDING, node.y))
      }
    }

    function draw() {
      if (!ctx) return
      ctx.clearRect(0, 0, W, H)

      // Draw edges
      for (const edge of edgesRef.current) {
        const a = nodeMap.get(edge.source)
        const b = nodeMap.get(edge.target)
        if (!a || !b) continue

        const color = SEVERITY_COLORS[edge.severity] ?? SEVERITY_COLORS.UNKNOWN
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.strokeStyle = color
        ctx.lineWidth = edge.severity === 'DANGEROUS' ? 3 : 2
        if (edge.severity === 'CAUTION') {
          ctx.setLineDash([6, 4])
        } else {
          ctx.setLineDash([])
        }
        ctx.stroke()
        ctx.setLineDash([])

        // Severity label on edge midpoint
        const mx = (a.x + b.x) / 2
        const my = (a.y + b.y) / 2
        ctx.font = '10px system-ui, sans-serif'
        ctx.fillStyle = color
        ctx.textAlign = 'center'
        ctx.fillText(edge.severity.toLowerCase(), mx, my - 6)
      }

      // Draw nodes
      for (const node of nodesRef.current) {
        // Circle
        ctx.beginPath()
        ctx.arc(node.x, node.y, NODE_RADIUS, 0, 2 * Math.PI)
        ctx.fillStyle = 'hsl(var(--card))'
        ctx.fill()
        ctx.strokeStyle = 'hsl(var(--border))'
        ctx.lineWidth = 2
        ctx.stroke()

        // Label
        ctx.font = 'bold 11px system-ui, sans-serif'
        ctx.fillStyle = 'hsl(var(--foreground))'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const label =
          node.name.length > 10 ? node.name.slice(0, 9) + '…' : node.name
        ctx.fillText(label, node.x, node.y)
      }
    }

    let ticks = 0
    function loop() {
      simulate()
      draw()
      ticks++
      if (ticks < 200) {
        animRef.current = requestAnimationFrame(loop)
      }
    }
    loop()

    return () => {
      cancelAnimationFrame(animRef.current)
    }
  }, [compounds, interactions])

  if (compounds.length < 2) return null

  return (
    <div className={cn('rounded-lg border bg-card', className)}>
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Interaction Graph</h3>
        <div className="mt-2 flex flex-wrap gap-3 text-[10px]">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
            Beneficial
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-500" />
            Caution
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
            Dangerous
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-500" />
            Neutral / Unknown
          </span>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        className="h-80 w-full"
        aria-label={`Interaction graph showing ${compounds.length} compounds and ${interactions.length} interactions`}
        role="img"
      />
    </div>
  )
}
