import { describe, expect, it } from 'vitest'
import {
  isValidTransition,
  nextAllowedStatus,
  LIFECYCLE,
} from '@/lib/validators/experiment'

describe('experiment lifecycle validator', () => {
  it('LIFECYCLE has exactly 5 states in the correct order', () => {
    expect(LIFECYCLE).toEqual([
      'PROPOSED',
      'SCREENED',
      'SENT_TO_LAB',
      'RESULT_LOGGED',
      'FED_BACK',
    ])
  })

  it('nextAllowedStatus returns the adjacent next step for each non-terminal state', () => {
    expect(nextAllowedStatus('PROPOSED')).toBe('SCREENED')
    expect(nextAllowedStatus('SCREENED')).toBe('SENT_TO_LAB')
    expect(nextAllowedStatus('SENT_TO_LAB')).toBe('RESULT_LOGGED')
    expect(nextAllowedStatus('RESULT_LOGGED')).toBe('FED_BACK')
  })

  it('nextAllowedStatus returns null for the terminal state FED_BACK', () => {
    expect(nextAllowedStatus('FED_BACK')).toBeNull()
  })

  it('isValidTransition approves each adjacent forward step', () => {
    expect(isValidTransition('PROPOSED', 'SCREENED')).toBe(true)
    expect(isValidTransition('SCREENED', 'SENT_TO_LAB')).toBe(true)
    expect(isValidTransition('SENT_TO_LAB', 'RESULT_LOGGED')).toBe(true)
    expect(isValidTransition('RESULT_LOGGED', 'FED_BACK')).toBe(true)
  })

  it('isValidTransition rejects backward moves', () => {
    expect(isValidTransition('SCREENED', 'PROPOSED')).toBe(false)
    expect(isValidTransition('SENT_TO_LAB', 'PROPOSED')).toBe(false)
    expect(isValidTransition('FED_BACK', 'RESULT_LOGGED')).toBe(false)
  })

  it('isValidTransition rejects skipping steps forward', () => {
    expect(isValidTransition('PROPOSED', 'SENT_TO_LAB')).toBe(false)
    expect(isValidTransition('PROPOSED', 'RESULT_LOGGED')).toBe(false)
    expect(isValidTransition('PROPOSED', 'FED_BACK')).toBe(false)
    expect(isValidTransition('SCREENED', 'RESULT_LOGGED')).toBe(false)
  })

  it('isValidTransition rejects same-status no-ops', () => {
    expect(isValidTransition('PROPOSED', 'PROPOSED')).toBe(false)
    expect(isValidTransition('SCREENED', 'SCREENED')).toBe(false)
  })
})
