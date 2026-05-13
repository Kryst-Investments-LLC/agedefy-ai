/**
 * Shared UI hints for a TwinDisplayPolicy. Wallet UIs, regulator portals
 * and the public verify endpoint all need to render the same disclosure
 * banner + badge for a given policy tier — keep the mapping in one place.
 */

import type { TwinDisplayPolicy } from "./twin-display-policy"

const BANNER_BY_TIER: Record<TwinDisplayPolicy["tier"], string | null> = {
  illustrative: "ILLUSTRATIVE - NOT CLINICAL GUIDANCE",
  "calibrated-partial":
    "CALIBRATED (PARTIAL) - some outcomes are low-confidence; review before clinical use",
  calibrated: null,
}

export interface TwinDisplayUiHints {
  banner: string | null
  badge: string
}

export function twinDisplayUiHints(policy: TwinDisplayPolicy): TwinDisplayUiHints {
  return {
    banner: BANNER_BY_TIER[policy.tier] ?? null,
    badge: policy.badgeLabel,
  }
}
