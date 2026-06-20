"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"

export interface ThreeContext {
  THREE: typeof THREE
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  controls: OrbitControls
}

export interface UseThreeSceneOptions {
  /** Build the scene contents. Return an optional per-frame callback. */
  onInit: (ctx: ThreeContext) => ((elapsed: number) => void) | void
  /** Initial camera position. */
  cameraPosition?: [number, number, number]
  /** Scene background colour (hex). */
  background?: number
  /** Orbit auto-rotate. */
  autoRotate?: boolean
  /** Dependency list — re-initializes the scene when these change. */
  deps?: unknown[]
}

/**
 * Shared raw-Three.js lifecycle hook. Mounts a WebGLRenderer into the returned
 * ref, wires OrbitControls, runs a RAF loop, handles resize, and disposes
 * everything on unmount. Keeps WebGL work strictly client-side.
 */
export function useThreeScene<T extends HTMLElement = HTMLDivElement>({
  onInit,
  cameraPosition = [0, 0, 6],
  background = 0x0b1020,
  autoRotate = false,
  deps = [],
}: UseThreeSceneOptions) {
  const mountRef = useRef<T | null>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const width = mount.clientWidth || 600
    const height = mount.clientHeight || 400

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(background)

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
    camera.position.set(...cameraPosition)

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      // WebGL unavailable (e.g. headless/JSDOM) — bail out gracefully.
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.autoRotate = autoRotate
    controls.autoRotateSpeed = 1.2

    // Sensible default lighting so callers don't have to.
    scene.add(new THREE.AmbientLight(0xffffff, 0.65))
    const key = new THREE.DirectionalLight(0xffffff, 0.9)
    key.position.set(5, 10, 7)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0x88aaff, 0.4)
    rim.position.set(-6, -3, -5)
    scene.add(rim)

    const onFrame = onInit({ THREE, scene, camera, renderer, controls })

    const clock = new THREE.Clock()
    let raf = 0
    const animate = () => {
      raf = requestAnimationFrame(animate)
      controls.update()
      if (onFrame) onFrame(clock.getElapsedTime())
      renderer.render(scene, camera)
    }
    animate()

    const handleResize = () => {
      const w = mount.clientWidth || width
      const h = mount.clientHeight || height
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener("resize", handleResize)
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(handleResize) : null
    ro?.observe(mount)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", handleResize)
      ro?.disconnect()
      controls.dispose()
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
        const mat = mesh.material
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
        else if (mat) (mat as THREE.Material).dispose()
      })
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return mountRef
}
