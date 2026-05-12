/**
 * Dexcom Direct CGM Client (T1.14)
 *
 * Minimal Dexcom OAuth 2.0 + EGV (Estimated Glucose Value) polling adapter.
 * Provides a Terra-independent path for CGM ingestion since CGM is the most
 * user-visible wearable signal and Terra has rate limits.
 *
 * API: https://developer.dexcom.com/overview
 * Sandbox host: https://sandbox-api.dexcom.com
 * Production host: https://api.dexcom.com
 *
 * Env:
 *   DEXCOM_CLIENT_ID
 *   DEXCOM_CLIENT_SECRET
 *   DEXCOM_REDIRECT_URI
 *   DEXCOM_API_HOST (optional; defaults to sandbox)
 */

import type { WearableEventPayload, WearableMetric } from '@/types/canonical-health-events'

export interface DexcomConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  host: string
}

export interface DexcomTokenResponse {
  access_token: string
  expires_in: number
  token_type: 'Bearer'
  refresh_token: string
}

export interface DexcomEgvRecord {
  systemTime: string
  displayTime: string
  value: number
  realtimeValue?: number
  smoothedValue?: number
  status?: string
  trend?: string
  trendRate?: number
  unit: 'mg/dL' | 'mmol/L'
  rateUnit?: string
  recordId?: string
}

export interface DexcomEgvResponse {
  recordType: 'egv'
  recordVersion: string
  userId: string
  records: DexcomEgvRecord[]
}

const DEFAULT_HOST = 'https://sandbox-api.dexcom.com'

export function getDexcomConfig(): DexcomConfig {
  return {
    clientId: process.env.DEXCOM_CLIENT_ID ?? '',
    clientSecret: process.env.DEXCOM_CLIENT_SECRET ?? '',
    redirectUri: process.env.DEXCOM_REDIRECT_URI ?? '',
    host: process.env.DEXCOM_API_HOST ?? DEFAULT_HOST,
  }
}

export function isDexcomConfigured(): boolean {
  const c = getDexcomConfig()
  return Boolean(c.clientId && c.clientSecret && c.redirectUri)
}

/**
 * Build the Dexcom OAuth authorize URL the user must visit to grant access.
 */
export function buildAuthorizeUrl(state: string, scope = 'offline_access'): string {
  const c = getDexcomConfig()
  const params = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: c.redirectUri,
    response_type: 'code',
    scope,
    state,
  })
  return `${c.host}/v2/oauth2/login?${params.toString()}`
}

/**
 * Exchange an authorization code for access + refresh tokens.
 */
export async function exchangeCodeForTokens(code: string): Promise<DexcomTokenResponse> {
  const c = getDexcomConfig()
  const body = new URLSearchParams({
    client_id: c.clientId,
    client_secret: c.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: c.redirectUri,
  })
  const res = await fetch(`${c.host}/v2/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Dexcom token exchange failed: ${res.status} ${text}`)
  }
  return (await res.json()) as DexcomTokenResponse
}

/**
 * Refresh an expired access token using the refresh token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<DexcomTokenResponse> {
  const c = getDexcomConfig()
  const body = new URLSearchParams({
    client_id: c.clientId,
    client_secret: c.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    redirect_uri: c.redirectUri,
  })
  const res = await fetch(`${c.host}/v2/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Dexcom token refresh failed: ${res.status} ${text}`)
  }
  return (await res.json()) as DexcomTokenResponse
}

/**
 * Fetch EGV (continuous glucose) records for an interval.
 * Times must be ISO 8601 without timezone (Dexcom expects local-naive timestamps).
 */
export async function fetchEgv(
  accessToken: string,
  startDate: string,
  endDate: string,
): Promise<DexcomEgvResponse> {
  const c = getDexcomConfig()
  const params = new URLSearchParams({ startDate, endDate })
  const res = await fetch(`${c.host}/v3/users/self/egvs?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Dexcom EGV fetch failed: ${res.status} ${text}`)
  }
  return (await res.json()) as DexcomEgvResponse
}

/**
 * Convert a Dexcom EGV response into canonical WearableEventPayload[].
 * Each EGV record becomes a single-metric wearable event with metric "glucose".
 *
 * Exported for unit testing without a live HTTP call.
 */
export function normalizeDexcomEgv(payload: DexcomEgvResponse): WearableEventPayload[] {
  const events: WearableEventPayload[] = []
  for (const rec of payload.records ?? []) {
    if (typeof rec.value !== 'number' || Number.isNaN(rec.value)) continue
    const ts = rec.systemTime ?? rec.displayTime ?? new Date().toISOString()
    const metrics: WearableMetric[] = [
      {
        metric: 'glucose',
        value: rec.value,
        unit: rec.unit ?? 'mg/dL',
      },
    ]
    if (typeof rec.trendRate === 'number') {
      metrics.push({
        metric: 'glucose_trend_rate',
        value: rec.trendRate,
        unit: rec.rateUnit ?? 'mg/dL/min',
      })
    }
    events.push({
      deviceType: 'cgm',
      deviceManufacturer: 'Dexcom',
      provider: 'dexcom',
      measurementWindow: { startedAt: ts, endedAt: ts },
      metrics,
      activityContext: 'daily-living',
      syncId: rec.recordId ?? payload.userId,
    })
  }
  return events
}

/**
 * Pull the most recent EGV window for a user and normalize it.
 */
export async function syncRecentEgv(
  accessToken: string,
  windowMinutes = 60,
): Promise<WearableEventPayload[]> {
  const end = new Date()
  const start = new Date(end.getTime() - windowMinutes * 60_000)
  // Dexcom expects ISO 8601 without timezone suffix.
  const fmt = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, '')
  const payload = await fetchEgv(accessToken, fmt(start), fmt(end))
  return normalizeDexcomEgv(payload)
}
