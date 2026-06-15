import { describe, expect, it } from 'vitest'
import { formatUncertainty } from '@/lib/types/annotated-value'
import type { UncertaintySpec } from '@/lib/types/annotated-value'

describe('formatUncertainty', () => {
  it('returns null for kind: none', () => {
    const u: UncertaintySpec = { kind: 'none' }
    expect(formatUncertainty(u)).toBeNull()
  })

  it('formats ci95 with lower and upper bounds', () => {
    const u: UncertaintySpec = { kind: 'ci95', lower: 0.62, upper: 0.88 }
    expect(formatUncertainty(u)).toBe('95% CI [0.62, 0.88]')
  })

  it('formats ci95 with correct 2-decimal rounding', () => {
    const u: UncertaintySpec = { kind: 'ci95', lower: 0.1, upper: 0.9 }
    expect(formatUncertainty(u)).toBe('95% CI [0.10, 0.90]')
  })

  it('formats std with ± prefix', () => {
    const u: UncertaintySpec = { kind: 'std', value: 0.05 }
    expect(formatUncertainty(u)).toBe('±0.05')
  })

  it('formats std with correct 2-decimal rounding', () => {
    const u: UncertaintySpec = { kind: 'std', value: 1.2 }
    expect(formatUncertainty(u)).toBe('±1.20')
  })

  it('formats qualitative very-low', () => {
    const u: UncertaintySpec = { kind: 'qualitative', level: 'very-low' }
    expect(formatUncertainty(u)).toBe('uncertainty: very-low')
  })

  it('formats qualitative low', () => {
    const u: UncertaintySpec = { kind: 'qualitative', level: 'low' }
    expect(formatUncertainty(u)).toBe('uncertainty: low')
  })

  it('formats qualitative moderate', () => {
    const u: UncertaintySpec = { kind: 'qualitative', level: 'moderate' }
    expect(formatUncertainty(u)).toBe('uncertainty: moderate')
  })

  it('formats qualitative high', () => {
    const u: UncertaintySpec = { kind: 'qualitative', level: 'high' }
    expect(formatUncertainty(u)).toBe('uncertainty: high')
  })
})
