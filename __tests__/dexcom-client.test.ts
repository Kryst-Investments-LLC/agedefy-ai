import { describe, expect, it } from 'vitest'

import { normalizeDexcomEgv, type DexcomEgvResponse } from '@/lib/wearables/dexcom-client'

describe('Dexcom client — normalizeDexcomEgv', () => {
  it('converts EGV records into canonical wearable events with glucose metric', () => {
    const payload: DexcomEgvResponse = {
      recordType: 'egv',
      recordVersion: '3.0',
      userId: 'dx-user-1',
      records: [
        {
          systemTime: '2026-05-12T10:00:00',
          displayTime: '2026-05-12T10:00:00',
          value: 112,
          unit: 'mg/dL',
          trendRate: -0.3,
          rateUnit: 'mg/dL/min',
          recordId: 'rec-1',
        },
        {
          systemTime: '2026-05-12T10:05:00',
          displayTime: '2026-05-12T10:05:00',
          value: 119,
          unit: 'mg/dL',
          recordId: 'rec-2',
        },
      ],
    }

    const events = normalizeDexcomEgv(payload)
    expect(events).toHaveLength(2)
    expect(events[0].provider).toBe('dexcom')
    expect(events[0].deviceManufacturer).toBe('Dexcom')
    expect(events[0].deviceType).toBe('cgm')
    expect(events[0].metrics.find((m) => m.metric === 'glucose')?.value).toBe(112)
    expect(events[0].metrics.find((m) => m.metric === 'glucose_trend_rate')?.value).toBe(-0.3)
    expect(events[1].metrics.find((m) => m.metric === 'glucose_trend_rate')).toBeUndefined()
  })

  it('skips records with non-numeric or missing values', () => {
    const payload: DexcomEgvResponse = {
      recordType: 'egv',
      recordVersion: '3.0',
      userId: 'dx-user-1',
      records: [
        // @ts-expect-error testing bad input
        { systemTime: 'x', displayTime: 'x', value: null, unit: 'mg/dL' },
        { systemTime: '2026-05-12T10:00:00', displayTime: 'x', value: NaN, unit: 'mg/dL' },
        { systemTime: '2026-05-12T10:00:00', displayTime: 'x', value: 100, unit: 'mg/dL' },
      ],
    }
    const events = normalizeDexcomEgv(payload)
    expect(events).toHaveLength(1)
    expect(events[0].metrics[0].value).toBe(100)
  })

  it('returns empty array when records list is missing', () => {
    const payload = { recordType: 'egv', recordVersion: '3.0', userId: 'x' } as DexcomEgvResponse
    expect(normalizeDexcomEgv(payload)).toEqual([])
  })
})
