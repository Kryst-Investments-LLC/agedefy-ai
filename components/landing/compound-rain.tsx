"use client"

import { useEffect, useRef } from "react"

/**
 * Animated "raining compounds" background for the landing hero.
 *
 * A lightweight 2D canvas (no WebGL) that drifts stylized molecule glyphs —
 * atoms connected by bonds — falling like rain, with slow rotation and a faint
 * glow. Purely decorative: absolutely positioned, pointer-events: none, low
 * opacity, and disabled when the user prefers reduced motion.
 */

type Atom = { dx: number; dy: number; r: number }
type MoleculeTemplate = { atoms: Atom[]; bonds: [number, number][] }

// A few simple molecular shapes for variety.
const TEMPLATES: MoleculeTemplate[] = [
  // diatomic
  { atoms: [{ dx: -10, dy: 0, r: 5 }, { dx: 10, dy: 0, r: 5 }], bonds: [[0, 1]] },
  // water-like bent triatomic
  { atoms: [{ dx: 0, dy: -8, r: 6 }, { dx: -12, dy: 8, r: 4 }, { dx: 12, dy: 8, r: 4 }], bonds: [[0, 1], [0, 2]] },
  // triangle ring
  { atoms: [{ dx: 0, dy: -12, r: 5 }, { dx: -12, dy: 8, r: 5 }, { dx: 12, dy: 8, r: 5 }], bonds: [[0, 1], [1, 2], [2, 0]] },
  // short chain
  { atoms: [{ dx: -18, dy: 0, r: 4 }, { dx: -6, dy: -6, r: 4 }, { dx: 6, dy: 6, r: 4 }, { dx: 18, dy: 0, r: 4 }], bonds: [[0, 1], [1, 2], [2, 3]] },
  // hexagon (benzene-ish)
  {
    atoms: [0, 1, 2, 3, 4, 5].map((i) => ({
      dx: Math.cos((i / 6) * Math.PI * 2) * 14,
      dy: Math.sin((i / 6) * Math.PI * 2) * 14,
      r: 4,
    })),
    bonds: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]],
  },
]

const COLORS = ["#2dd4bf", "#3b82f6", "#8b5cf6", "#22c55e", "#f59e0b", "#ec4899"]

interface Molecule {
  x: number
  y: number
  vy: number
  vx: number
  rot: number
  vrot: number
  scale: number
  alpha: number
  color: string
  template: MoleculeTemplate
}

export function CompoundRain({ density = 36 }: { density?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    let width = 0
    let height = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const resize = () => {
      const parent = canvas.parentElement
      width = parent?.clientWidth ?? window.innerWidth
      height = parent?.clientHeight ?? window.innerHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    const rnd = (a: number, b: number) => a + Math.random() * (b - a)
    const spawn = (atTop: boolean): Molecule => ({
      x: rnd(0, width),
      y: atTop ? rnd(-height, 0) : rnd(0, height),
      vy: rnd(12, 38),
      vx: rnd(-6, 6),
      rot: rnd(0, Math.PI * 2),
      vrot: rnd(-0.5, 0.5),
      scale: rnd(0.5, 1.3),
      alpha: rnd(0.18, 0.5),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      template: TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)],
    })

    const count = Math.max(8, Math.round((width / 1400) * density))
    const molecules: Molecule[] = Array.from({ length: count }, () => spawn(false))

    const drawMolecule = (m: Molecule) => {
      ctx.save()
      ctx.translate(m.x, m.y)
      ctx.rotate(m.rot)
      ctx.scale(m.scale, m.scale)
      ctx.globalAlpha = m.alpha
      ctx.strokeStyle = m.color
      ctx.fillStyle = m.color
      ctx.lineWidth = 1.5
      ctx.shadowColor = m.color
      ctx.shadowBlur = 8

      const { atoms, bonds } = m.template
      for (const [i, j] of bonds) {
        ctx.beginPath()
        ctx.moveTo(atoms[i].dx, atoms[i].dy)
        ctx.lineTo(atoms[j].dx, atoms[j].dy)
        ctx.stroke()
      }
      for (const a of atoms) {
        ctx.beginPath()
        ctx.arc(a.dx, a.dy, a.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      ctx.clearRect(0, 0, width, height)
      for (const m of molecules) {
        m.y += m.vy * dt
        m.x += m.vx * dt
        m.rot += m.vrot * dt
        if (m.y - 30 > height) {
          Object.assign(m, spawn(true), { y: rnd(-40, -10) })
        }
        if (m.x < -40) m.x = width + 30
        if (m.x > width + 40) m.x = -30
        drawMolecule(m)
      }
      raf = requestAnimationFrame(frame)
    }

    if (reduce) {
      // Draw a single static frame for reduced-motion users.
      ctx.clearRect(0, 0, width, height)
      molecules.forEach(drawMolecule)
    } else {
      raf = requestAnimationFrame(frame)
    }

    window.addEventListener("resize", resize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", resize)
    }
  }, [density])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  )
}
