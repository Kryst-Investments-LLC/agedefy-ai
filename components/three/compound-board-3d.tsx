"use client"

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { DragControls } from "three/examples/jsm/controls/DragControls.js"

import { useThreeScene } from "./use-three-scene"

export interface BoardCompound {
  id: string
  name: string
  /** Category drives colour. */
  category?: string | null
}

interface CompoundBoard3DProps {
  compounds: BoardCompound[]
  height?: number
  /** Fired when a node is tapped/clicked (not dragged). */
  onSelect?: (id: string) => void
}

const CATEGORY_COLORS: Record<string, number> = {
  nootropic: 0x8b5cf6,
  longevity: 0x22c55e,
  metabolic: 0xf59e0b,
  hormone: 0xec4899,
  vitamin: 0x3b82f6,
  mineral: 0x14b8a6,
  peptide: 0xef4444,
  default: 0x64748b,
}

function colorFor(category?: string | null): number {
  if (!category) return CATEGORY_COLORS.default
  const key = category.toLowerCase()
  for (const k of Object.keys(CATEGORY_COLORS)) {
    if (key.includes(k)) return CATEGORY_COLORS[k]
  }
  return CATEGORY_COLORS.default
}

/** Build a sprite label from text via a canvas texture. */
function makeLabel(text: string): THREE.Sprite {
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")!
  const font = "28px system-ui, sans-serif"
  ctx.font = font
  const padding = 16
  const w = Math.ceil(ctx.measureText(text).width) + padding * 2
  const h = 48
  canvas.width = w
  canvas.height = h
  ctx.font = font
  ctx.fillStyle = "rgba(15,23,42,0.85)"
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = "#e2e8f0"
  ctx.textBaseline = "middle"
  ctx.fillText(text, padding, h / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set((w / h) * 0.6, 0.6, 1)
  return sprite
}

/**
 * Touch-and-drag interactive 3D board. Each compound is a draggable node the
 * user can pick up and move anywhere on the board — works with mouse and with
 * touch (Pointer Events), so it behaves like a smart-screen / touch-table.
 * Orbit to rotate the whole board; drag a node to reposition it; tap to select.
 */
export function CompoundBoard3D({ compounds, height = 480, onSelect }: CompoundBoard3DProps) {
  const onSelectRef = useRef(onSelect)
  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])

  const [active, setActive] = useState<string | null>(null)
  const key = compounds.map((c) => `${c.id}:${c.name}`).join("|")

  const mountRef = useThreeScene<HTMLDivElement>({
    cameraPosition: [0, 6, 9],
    background: 0x0b1020,
    autoRotate: false,
    deps: [key],
    onInit: ({ scene, camera, renderer, controls }) => {
      // Ground board
      const board = new THREE.Mesh(
        new THREE.PlaneGeometry(16, 12),
        new THREE.MeshStandardMaterial({ color: 0x111a2e, roughness: 0.9 }),
      )
      board.rotation.x = -Math.PI / 2
      board.position.y = -0.01
      scene.add(board)
      const grid = new THREE.GridHelper(16, 16, 0x334155, 0x1e293b)
      scene.add(grid)

      // Compound nodes arranged in a loose grid; draggable.
      const nodes: THREE.Object3D[] = []
      const cols = Math.ceil(Math.sqrt(Math.max(1, compounds.length)))
      const spacing = 2.4

      compounds.forEach((c, i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        const x = (col - (cols - 1) / 2) * spacing
        const z = (row - Math.floor(compounds.length / cols) / 2) * spacing

        const node = new THREE.Group()
        const color = colorFor(c.category)
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.55, 28, 28),
          new THREE.MeshStandardMaterial({
            color, emissive: color, emissiveIntensity: 0.25, roughness: 0.35, metalness: 0.2,
          }),
        )
        sphere.position.y = 0.55
        node.add(sphere)

        const label = makeLabel(c.name)
        label.position.set(0, 1.45, 0)
        node.add(label)

        node.position.set(x, 0, z)
        node.userData = { id: c.id, dragging: false, downPos: new THREE.Vector2() }
        scene.add(node)
        nodes.push(node)
      })

      // DragControls works for both mouse and touch (Pointer Events).
      const drag = new DragControls(nodes, camera, renderer.domElement)
      // Keep nodes on the board plane while dragging.
      drag.addEventListener("dragstart", (e) => {
        controls.enabled = false
        ;(e.object as THREE.Object3D).userData.dragging = false
      })
      drag.addEventListener("drag", (e) => {
        const obj = e.object as THREE.Object3D
        obj.position.y = 0 // lock to the board
        obj.userData.dragging = true
      })
      drag.addEventListener("dragend", (e) => {
        controls.enabled = true
        const obj = e.object as THREE.Object3D
        // A drag with no movement is a tap → select.
        if (!obj.userData.dragging) {
          setActive(obj.userData.id as string)
          onSelectRef.current?.(obj.userData.id as string)
        }
      })
      renderer.domElement.style.touchAction = "none" // let us handle touch gestures

      return (elapsed: number) => {
        for (const n of nodes) {
          const sphere = n.children[0] as THREE.Mesh
          const mat = sphere.material as THREE.MeshStandardMaterial
          const isActive = n.userData.id === active
          mat.emissiveIntensity = isActive ? 0.8 : 0.25
          // gentle bob
          sphere.position.y = 0.55 + Math.sin(elapsed * 1.5 + n.position.x) * 0.04
        }
      }
    },
  })

  return (
    <div className="space-y-2">
      <div
        ref={mountRef}
        style={{ height, width: "100%", touchAction: "none" }}
        className="rounded-lg bg-[#0b1020]"
        aria-label="Interactive 3D compound board — drag compounds to arrange them"
      />
      <p className="text-[11px] text-muted-foreground">
        Drag a compound to move it · pinch/scroll to zoom · drag empty space to rotate · tap to select.
        {active ? ` Selected: ${compounds.find((c) => c.id === active)?.name ?? active}` : ""}
      </p>
    </div>
  )
}
