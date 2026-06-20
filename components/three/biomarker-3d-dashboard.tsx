"use client"

import * as THREE from "three"

import {
  type ClassifiedBiomarker,
  type OrganSystem,
  statusColor,
} from "@/lib/biomarkers/organ-mapping"
import { useThreeScene } from "./use-three-scene"

interface Biomarker3DDashboardProps {
  biomarkers: ClassifiedBiomarker[]
  height?: number
}

const ORGAN_ORDER: OrganSystem[] = [
  "cardiovascular", "metabolic", "liver", "kidney",
  "thyroid", "immune", "hematology", "endocrine",
]

/**
 * Orbitable 3D bar field. Each biomarker is a bar: height encodes how far it
 * sits outside its optimal band (severity), colour encodes status. Bars are
 * grouped into rows by organ system along the X axis.
 */
export function Biomarker3DDashboard({ biomarkers, height = 460 }: Biomarker3DDashboardProps) {
  const key = biomarkers
    .map((b) => `${b.name}:${b.status}:${b.severity.toFixed(2)}`)
    .join("|")

  const mountRef = useThreeScene<HTMLDivElement>({
    cameraPosition: [6, 5.5, 8],
    background: 0x0b1020,
    autoRotate: true,
    deps: [key],
    onInit: ({ scene }) => {
      const group = new THREE.Group()

      // group biomarkers by organ, in fixed order
      const byOrgan = new Map<OrganSystem, ClassifiedBiomarker[]>()
      for (const b of biomarkers) {
        const arr = byOrgan.get(b.organ) ?? []
        arr.push(b)
        byOrgan.set(b.organ, arr)
      }
      const rows = ORGAN_ORDER.filter((o) => byOrgan.has(o))

      const spacing = 1.1
      const maxCols = Math.max(1, ...rows.map((o) => byOrgan.get(o)!.length))
      const width = (maxCols - 1) * spacing
      const depth = (rows.length - 1) * spacing

      // base grid
      const grid = new THREE.GridHelper(
        Math.max(width, depth) + 2,
        Math.max(maxCols, rows.length) + 2,
        0x334155,
        0x1e293b,
      )
      grid.position.y = 0
      group.add(grid)

      const bars: Array<{ mesh: THREE.Mesh; target: number }> = []

      rows.forEach((organ, ri) => {
        const list = byOrgan.get(organ)!
        list.forEach((b, ci) => {
          const barHeight = Math.max(0.25, b.severity * 3 + (b.status === "optimal" ? 0.25 : 0.5))
          const geo = new THREE.BoxGeometry(0.6, barHeight, 0.6)
          const color = statusColor(b.status)
          const mat = new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: b.status === "optimal" ? 0.15 : 0.45,
            roughness: 0.35,
            metalness: 0.15,
          })
          const mesh = new THREE.Mesh(geo, mat)
          mesh.position.set(
            ci * spacing - width / 2,
            barHeight / 2,
            ri * spacing - depth / 2,
          )
          mesh.userData.label = b.name
          group.add(mesh)
          bars.push({ mesh, target: barHeight })

          // start collapsed for a grow-in animation
          mesh.scale.y = 0.01
        })
      })

      scene.add(group)

      let t = 0
      return (elapsed: number) => {
        // grow-in animation over the first ~1.2s
        if (t < 1) {
          t = Math.min(1, elapsed / 1.2)
          const e = 1 - Math.pow(1 - t, 3) // easeOutCubic
          for (const { mesh, target } of bars) {
            mesh.scale.y = Math.max(0.01, e)
            mesh.position.y = (target * e) / 2
          }
        }
      }
    },
  })

  return (
    <div
      ref={mountRef}
      style={{ height, width: "100%" }}
      className="rounded-lg bg-[#0b1020]"
      aria-label="3D dashboard of biomarkers by organ system and status"
    />
  )
}
