/**
 * sidecar-health — fan-out probe for every external sidecar that the agedefy
 * runtime depends on. Each entry reports its env-driven URL, whether the URL
 * is configured (so we can distinguish "deliberately disabled" from "broken
 * deployment"), an overall reachable boolean, and the version string from
 * the sidecar's own /healthz.
 *
 * Used by `/api/health` to surface sidecar status without changing the
 * top-level health contract (the route stays 200 as long as the database is
 * up; a sidecar outage only flips the relevant sidecar to `degraded`).
 */

import { causalSidecar, dpAccountant, mechanisticSidecar, vcSigner } from "@/lib/sidecars"

export type SidecarStatus = "ok" | "degraded" | "not-configured"

export interface SidecarHealthEntry {
  name: string
  status: SidecarStatus
  url: string | null
  /** True when the corresponding `*_URL` env var is set. */
  configured: boolean
  version?: string
  error?: string
}

interface SidecarSpec {
  name: string
  url: () => string
  configured: () => boolean
  probe: (traceparent?: string) => Promise<{ status: string; version?: string }>
}

const SIDECAR_PROBE_TIMEOUT_MS = 1500

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`sidecar probe timed out after ${ms}ms`)), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

const SPECS: SidecarSpec[] = [
  {
    name: "causal",
    url: causalSidecar.url,
    configured: () => Boolean(process.env.CAUSAL_SIDECAR_URL),
    probe: causalSidecar.health,
  },
  {
    name: "dp-accountant",
    url: dpAccountant.url,
    configured: () => Boolean(process.env.DP_ACCOUNTANT_URL),
    probe: dpAccountant.health,
  },
  {
    name: "vc-signer",
    url: vcSigner.url,
    configured: () => Boolean(process.env.VC_SIGNER_URL),
    probe: async (traceparent?: string) => {
      const r = await vcSigner.health(traceparent)
      // vc-signer's /healthz returns { status, issuer } — surface issuer as version.
      return { status: r.status, version: r.issuer }
    },
  },
  {
    name: "mechanistic",
    url: mechanisticSidecar.url,
    configured: mechanisticSidecar.configured,
    probe: mechanisticSidecar.health,
  },
]

async function probeOne(spec: SidecarSpec): Promise<SidecarHealthEntry> {
  if (!spec.configured()) {
    return {
      name: spec.name,
      status: "not-configured",
      url: null,
      configured: false,
    }
  }
  try {
    const result = await withTimeout(spec.probe(), SIDECAR_PROBE_TIMEOUT_MS)
    return {
      name: spec.name,
      status: result.status === "ok" ? "ok" : "degraded",
      url: spec.url(),
      configured: true,
      version: result.version,
    }
  } catch (err) {
    return {
      name: spec.name,
      status: "degraded",
      url: spec.url(),
      configured: true,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/** Run all sidecar /healthz probes in parallel. Never throws. */
export async function probeSidecars(): Promise<SidecarHealthEntry[]> {
  return Promise.all(SPECS.map(probeOne))
}
