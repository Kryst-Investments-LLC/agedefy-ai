import { describe, expect, it } from 'vitest'

import { normalizeTerraPayload } from '@/lib/wearables/normalizer'
import { verifyWebhookSignature } from '@/lib/wearables/terra-client'

// ---------------------------------------------------------------------------
// normalizeTerraPayload
// ---------------------------------------------------------------------------

describe('normalizeTerraPayload', () => {
  it('normalizes a body payload with weight', () => {
    const result = normalizeTerraPayload({
      type: 'body',
      user: { user_id: 'terra-1', provider: 'FITBIT', reference_id: 'user-1' },
      data: [{ timestamp: '2024-06-01T08:00:00Z', weight_kg: 75.2, body_fat_percentage: 18 }],
    })
    expect(result).toHaveLength(1)
    expect(result[0].deviceManufacturer).toBe('Fitbit')
    expect(result[0].activityContext).toBe('resting')
    const metricNames = result[0].metrics.map((m) => m.metric)
    expect(metricNames).toContain('weight')
    expect(metricNames).toContain('body_fat')
  })

  it('normalizes an activity payload with steps and calories', () => {
    const result = normalizeTerraPayload({
      type: 'activity',
      user: { user_id: 'terra-1', provider: 'GARMIN', reference_id: 'user-1' },
      data: [{ timestamp: '2024-06-01T10:00:00Z', calories: 500, steps: 8000 }],
    })
    expect(result).toHaveLength(1)
    expect(result[0].deviceManufacturer).toBe('Garmin')
    expect(result[0].activityContext).toBe('exercise')
    const metricNames = result[0].metrics.map((m) => m.metric)
    expect(metricNames).toContain('calories_burned')
    expect(metricNames).toContain('steps')
  })

  it('normalizes a sleep payload with duration and HRV', () => {
    const result = normalizeTerraPayload({
      type: 'sleep',
      user: { user_id: 'terra-1', provider: 'OURA', reference_id: 'user-1' },
      data: [
        {
          timestamp: '2024-06-01T23:00:00Z',
          duration_asleep_seconds: 28800,
          sleep_efficiency: 0.92,
          heart_rate_data: { summary: { avg_hrv_rmssd: 42, avg_hr_bpm: 55 } },
        },
      ],
    })
    expect(result).toHaveLength(1)
    expect(result[0].activityContext).toBe('sleep')
    const metricNames = result[0].metrics.map((m) => m.metric)
    expect(metricNames).toContain('total_sleep')
    expect(metricNames).toContain('sleep_efficiency')
    expect(metricNames).toContain('hrv')
    expect(metricNames).toContain('sleep_avg_hr')
  })

  it('skips samples with zero extractable metrics', () => {
    const result = normalizeTerraPayload({
      type: 'body',
      user: { user_id: 'terra-1', provider: 'FITBIT', reference_id: 'user-1' },
      data: [{ timestamp: '2024-06-01T08:00:00Z' }], // no numeric fields
    })
    expect(result).toHaveLength(0)
  })

  it('handles multiple data samples', () => {
    const result = normalizeTerraPayload({
      type: 'activity',
      user: { user_id: 'terra-1', provider: 'GARMIN', reference_id: 'user-1' },
      data: [
        { timestamp: '2024-06-01T10:00:00Z', steps: 3000 },
        { timestamp: '2024-06-01T14:00:00Z', steps: 5000 },
      ],
    })
    expect(result).toHaveLength(2)
  })

  it('handles empty data array', () => {
    const result = normalizeTerraPayload({
      type: 'activity',
      user: { user_id: 'terra-1', provider: 'GARMIN', reference_id: 'user-1' },
      data: [],
    })
    expect(result).toHaveLength(0)
  })

  it('handles unknown provider gracefully', () => {
    const result = normalizeTerraPayload({
      type: 'body',
      user: { user_id: 'terra-1', provider: 'NEWDEVICE', reference_id: 'user-1' },
      data: [{ timestamp: '2024-06-01T08:00:00Z', weight_kg: 70 }],
    })
    expect(result).toHaveLength(1)
    expect(result[0].deviceManufacturer).toBe('NEWDEVICE')
  })

  it('normalizes daily payload combining activity and body metrics', () => {
    const result = normalizeTerraPayload({
      type: 'daily',
      user: { user_id: 'terra-1', provider: 'APPLE', reference_id: 'user-1' },
      data: [{ timestamp: '2024-06-01T00:00:00Z', steps: 12000, weight_kg: 72 }],
    })
    expect(result).toHaveLength(1)
    expect(result[0].activityContext).toBe('daily-living')
    const metricNames = result[0].metrics.map((m) => m.metric)
    expect(metricNames).toContain('steps')
    expect(metricNames).toContain('weight')
  })
})

// ---------------------------------------------------------------------------
// verifyWebhookSignature
// ---------------------------------------------------------------------------

describe('verifyWebhookSignature', () => {
  it('returns false when webhook secret is not configured', () => {
    // env var TERRA_WEBHOOK_SECRET is not set in test env
    const result = verifyWebhookSignature('{}', 'abc123')
    expect(result).toBe(false)
  })
})
