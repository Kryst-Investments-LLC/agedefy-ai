"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"

import {
  type OrganSummary,
  type OrganSystem,
  statusColor,
} from "@/lib/biomarkers/organ-mapping"
import { useThreeScene } from "./use-three-scene"

interface AnatomyViewerProps {
  organs: OrganSummary[]
  selected?: OrganSystem | null
  onSelect?: (organ: OrganSystem) => void
  height?: number
}

/** Approximate anatomical anchor for each organ system (body centred at origin). */
const ORGAN_POSITIONS: Record<OrganSystem, [number, number, number]> = {
  thyroid:        [0, 1.35, 0.32],
  cardiovascular: [-0.22, 0.72, 0.42],
  immune:         [-0.4, 0.28, 0.36],
  liver:          [0.38, 0.28, 0.42],
  metabolic:      [0, 0.12, 0.46],
  hematology:     [0, -0.25, 0.44],
  kidney:         [0.32, -0.15, -0.34],
  endocrine:      [-0.3, -0.18, 0.4],
}

export function AnatomyViewer({ organs, selected, onSelect, height = 460 }: AnatomyViewerProps) {
  // Keep latest props available to the (long-lived) click handler.
  const onSelectRef = useRef(onSelect)
  const selectedRef = useRef(selected)
  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])
  useEffect(() => { selectedRef.current = selected }, [selected])

  const organKey = organs
    .map((o) => `${o.organ}:${o.status}:${o.severity.toFixed(2)}`)
    .join("|")

  const mountRef = useThreeScene<HTMLDivElement>({
    cameraPosition: [0, 0.3, 4.6],
    background: 0x0b1020,
    autoRotate: false,
    deps: [organKey],
    onInit: ({ scene, camera, renderer }) => {
      // ── Stylized translucent humanoid ──────────────────────────────────
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x3b82f6,
        transparent: true,
        opacity: 0.14,
        roughness: 0.4,
        metalness: 0.1,
      })
      const body = new THREE.Group()

      const add = (geo: THREE.BufferGeometry, pos: [number, number, number]) => {
        const m = new THREE.Mesh(geo, bodyMat)
        m.position.set(...pos)
        body.add(m)
      }
      add(new THREE.SphereGeometry(0.32, 24, 24), [0, 1.6, 0])          // head
      add(new THREE.CylinderGeometry(0.08, 0.1, 0.28, 16), [0, 1.28, 0]) // neck
      add(new THREE.CapsuleGeometry(0.42, 0.8, 8, 16), [0, 0.55, 0])     // torso
      add(new THREE.CapsuleGeometry(0.28, 0.5, 8, 16), [0, -0.25, 0])    // hips
      // arms
      add(new THREE.CapsuleGeometry(0.1, 0.85, 6, 12), [-0.62, 0.55, 0])
      add(new THREE.CapsuleGeometry(0.1, 0.85, 6, 12), [0.62, 0.55, 0])
      // legs
      add(new THREE.CapsuleGeometry(0.13, 1.0, 6, 12), [-0.22, -1.2, 0])
      add(new THREE.CapsuleGeometry(0.13, 1.0, 6, 12), [0.22, -1.2, 0])
      scene.add(body)

      // ── Organ markers ───────────────────────────────────────────────────
      const markers: THREE.Mesh[] = []
      const pulsing: Array<{ mesh: THREE.Mesh; base: number }> = []

      for (const o of organs) {
        const pos = ORGAN_POSITIONS[o.organ]
        const color = statusColor(o.status)
        const radius = 0.1 + o.severity * 0.06
        const geo = new THREE.SphereGeometry(radius, 20, 20)
        const mat = new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: o.status === "optimal" ? 0.25 : 0.6,
          roughness: 0.3,
        })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.position.set(...pos)
        mesh.userData.organ = o.organ
        scene.add(mesh)
        markers.push(mesh)

        // halo ring to make markers pop
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(radius * 1.4, radius * 1.7, 24),
          new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }),
        )
        ring.position.set(...pos)
        ring.lookAt(camera.position)
        scene.add(ring)

        if (o.status !== "optimal") pulsing.push({ mesh, base: radius })
      }

      // ── Click → select ───────────────────────────────────────────────────
      const raycaster = new THREE.Raycaster()
      const pointer = new THREE.Vector2()
      const handleClick = (ev: MouseEvent) => {
        const rect = renderer.domElement.getBoundingClientRect()
        pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1
        pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1
        raycaster.setFromCamera(pointer, camera)
        const hit = raycaster.intersectObjects(markers, false)[0]
        if (hit) {
          const organ = hit.object.userData.organ as OrganSystem
          onSelectRef.current?.(organ)
        }
      }
      renderer.domElement.addEventListener("click", handleClick)
      renderer.domElement.style.cursor = "grab"

      return (elapsed: number) => {
        // pulse non-optimal markers; highlight the selected organ
        for (const p of pulsing) {
          const s = 1 + Math.sin(elapsed * 3) * 0.12
          p.mesh.scale.setScalar(s)
        }
        for (const m of markers) {
          const isSel = m.userData.organ === selectedRef.current
          const mat = m.material as THREE.MeshStandardMaterial
          mat.emissiveIntensity = isSel ? 1.0 : (m.userData.organ && mat.color.getHex() === statusColor("optimal") ? 0.25 : 0.6)
        }
        body.rotation.y = Math.sin(elapsed * 0.15) * 0.15
      }
    },
  })

  return (
    <div
      ref={mountRef}
      style={{ height, width: "100%" }}
      className="rounded-lg bg-[#0b1020]"
      aria-label="3D anatomy view of biomarker status by organ system"
    />
  )
}
