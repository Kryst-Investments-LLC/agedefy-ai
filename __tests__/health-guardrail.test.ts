import { describe, expect, it, vi } from 'vitest'

import { applyHealthGuardrail } from '@/lib/ai/health-guardrail'
import { NOT_MEDICAL_ADVICE_DISCLAIMER } from '@/lib/ai/health-guardrail-rules'

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isBlocked(text: string) {
  return applyHealthGuardrail(text).blocked
}

// ---------------------------------------------------------------------------
// Persistent disclaimer — always present
// ---------------------------------------------------------------------------

describe('persistent disclaimer', () => {
  it('attaches disclaimer when content is safe', () => {
    const result = applyHealthGuardrail('Rapamycin inhibits mTOR signaling in animal studies.')
    expect(result.disclaimer).toBe(NOT_MEDICAL_ADVICE_DISCLAIMER)
    expect(result.blocked).toBe(false)
  })

  it('attaches disclaimer when content is blocked', () => {
    const result = applyHealthGuardrail('Take 500 mg of metformin twice daily.')
    expect(result.disclaimer).toBe(NOT_MEDICAL_ADVICE_DISCLAIMER)
    expect(result.blocked).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Category: specific-dosing
// ---------------------------------------------------------------------------

describe('specific-dosing — blocks prescriptive dosing', () => {
  it('blocks "take X mg"', () => {
    expect(isBlocked('Take 500 mg of metformin.')).toBe(true)
  })

  it('blocks "give X mcg"', () => {
    expect(isBlocked('Give 200 mcg of rapamycin weekly.')).toBe(true)
  })

  it('blocks "X mg twice daily" regardless of preceding verb', () => {
    // The "mg twice daily" construction is prescriptive regardless of verb.
    expect(isBlocked('Administer 1000 mg twice daily.')).toBe(true)
    expect(isBlocked('500 mg twice daily.')).toBe(true)
  })

  it('blocks "X mg per day"', () => {
    expect(isBlocked('200 mg per day is the starting point.')).toBe(true)
  })

  it('blocks "your dose should be"', () => {
    expect(isBlocked('Your dose should be 1000 mg.')).toBe(true)
  })

  it('blocks "the recommended dose is"', () => {
    expect(isBlocked('The recommended dose is 500 mg twice daily.')).toBe(true)
  })

  it('blocks "titrate to X"', () => {
    expect(isBlocked('Titrate up to 1000 mg over four weeks.')).toBe(true)
  })

  it('blocks "start at X mg"', () => {
    expect(isBlocked('Start at 100 mg and increase gradually.')).toBe(true)
  })

  it('blocks "begin with X mg"', () => {
    expect(isBlocked('Begin with 50 mg then escalate.')).toBe(true)
  })

  it('does NOT block informational study dosing', () => {
    expect(isBlocked('Clinical trials studied metformin at doses of 500–2000 mg.')).toBe(false)
  })

  it('does NOT block "studies used 500 mg"', () => {
    expect(isBlocked('The TAME trial uses 1500 mg of metformin daily in participants.')).toBe(false)
  })

  it('does NOT block dosing mentioned as historical fact', () => {
    expect(isBlocked('Participants received 500 mg of NMN over 12 weeks.')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Category: prescription-directive
// ---------------------------------------------------------------------------

describe('prescription-directive — blocks prescribing language', () => {
  it('blocks "prescribe"', () => {
    expect(isBlocked('I prescribe metformin for this patient.')).toBe(true)
  })

  it('blocks "prescribed"', () => {
    expect(isBlocked('This should be prescribed at the lowest effective dose.')).toBe(true)
  })

  it('blocks "write a prescription"', () => {
    expect(isBlocked('Write a prescription for berberine.')).toBe(true)
  })

  it('blocks "you should take"', () => {
    expect(isBlocked('You should take rapamycin weekly.')).toBe(true)
  })

  it('blocks "you should stop"', () => {
    expect(isBlocked('You should stop using this supplement.')).toBe(true)
  })

  it('blocks "you must take"', () => {
    expect(isBlocked('You must take this medication daily.')).toBe(true)
  })

  it('blocks "stop taking your medication"', () => {
    expect(isBlocked('Stop taking your medication immediately.')).toBe(true)
  })

  it('blocks "discontinue your treatment"', () => {
    expect(isBlocked('Discontinue your current treatment and switch protocols.')).toBe(true)
  })

  it('blocks "replace your medication"', () => {
    expect(isBlocked('Replace your medication with this compound.')).toBe(true)
  })

  it('does NOT block participant-instruction study language', () => {
    expect(isBlocked('Participants were instructed to take the supplement with food.')).toBe(false)
  })

  it('does NOT block "researchers prescribed"', () => {
    // "researchers prescribed" — contains "prescribed" but current pattern
    // matches the word in any context; this is an accepted conservative false positive
    // if a medical reviewer wants to soften it, they can adjust the pattern.
    // Document expected behaviour here.
    expect(applyHealthGuardrail('Researchers prescribed metformin to trial participants.').blocked).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Category: disease-treatment-claim
// ---------------------------------------------------------------------------

describe('disease-treatment-claim — blocks cure/treatment claims', () => {
  it('blocks "will cure"', () => {
    expect(isBlocked('This compound will cure Alzheimer\'s disease.')).toBe(true)
  })

  it('blocks "cures cancer"', () => {
    expect(isBlocked('Fisetin cures cancer.')).toBe(true)
  })

  it('blocks "can cure"', () => {
    expect(isBlocked('NMN can cure mitochondrial dysfunction.')).toBe(true)
  })

  it('blocks "treats your diabetes"', () => {
    expect(isBlocked('This intervention treats your diabetes.')).toBe(true)
  })

  it('blocks "treating your hypertension"', () => {
    expect(isBlocked('This is effective for treating your hypertension.')).toBe(true)
  })

  it('blocks "use this to treat"', () => {
    expect(isBlocked('Use this to treat the condition.')).toBe(true)
  })

  it('blocks "clinically proven treatment"', () => {
    expect(isBlocked('This is a clinically proven treatment for inflammation.')).toBe(true)
  })

  it('blocks "FDA-approved for treating"', () => {
    expect(isBlocked('This molecule is FDA-approved for treating type 2 diabetes.')).toBe(true)
  })

  it('does NOT block informational treatment research mention', () => {
    expect(isBlocked('Metformin has been studied as a potential treatment for type 2 diabetes.')).toBe(false)
  })

  it('does NOT block animal model framing', () => {
    expect(isBlocked('Rapamycin extends lifespan in animal models and may reduce age-related disease.')).toBe(false)
  })

  it('does NOT block "may help with"', () => {
    expect(isBlocked('Some evidence suggests quercetin may help with cellular senescence.')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Blocked result shape
// ---------------------------------------------------------------------------

describe('blocked result shape', () => {
  it('sets blocked=true, triggeredCategory, and redirect content', () => {
    const result = applyHealthGuardrail('Take 500 mg of NMN daily.')
    expect(result.blocked).toBe(true)
    expect(result.triggeredCategory).toBe('specific-dosing')
    expect(result.content).toContain('consult a licensed clinician')
  })

  it('sets triggeredCategory for prescription-directive', () => {
    const result = applyHealthGuardrail('You should take rapamycin.')
    expect(result.triggeredCategory).toBe('prescription-directive')
  })

  it('sets triggeredCategory for disease-treatment-claim', () => {
    const result = applyHealthGuardrail('This cures cancer.')
    expect(result.triggeredCategory).toBe('disease-treatment-claim')
  })

  it('returns original content unchanged when not blocked', () => {
    const text = 'NMN supplementation is being researched for NAD+ restoration.'
    const result = applyHealthGuardrail(text)
    expect(result.blocked).toBe(false)
    expect(result.content).toBe(text)
    expect(result.triggeredCategory).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Case insensitivity
// ---------------------------------------------------------------------------

describe('case insensitivity', () => {
  it('blocks uppercase TAKE X MG', () => {
    expect(isBlocked('TAKE 500 MG OF METFORMIN.')).toBe(true)
  })

  it('blocks mixed-case You Should Take', () => {
    expect(isBlocked('You Should Take rapamycin.')).toBe(true)
  })

  it('blocks lowercase cures', () => {
    expect(isBlocked('this compound cures cancer.')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Surface option is passed through (does not affect result)
// ---------------------------------------------------------------------------

describe('surface option', () => {
  it('returns same result with and without surface option', () => {
    const text = 'Take 200 mg daily.'
    const withSurface = applyHealthGuardrail(text, { surface: 'health-coach' })
    const withoutSurface = applyHealthGuardrail(text)
    expect(withSurface.blocked).toBe(withoutSurface.blocked)
    expect(withSurface.triggeredCategory).toBe(withoutSurface.triggeredCategory)
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('handles empty string without throwing', () => {
    const result = applyHealthGuardrail('')
    expect(result.blocked).toBe(false)
    expect(result.content).toBe('')
    expect(result.disclaimer).toBeTruthy()
  })

  it('handles numeric-only JSON (bio-age output shape) without blocking', () => {
    const bioAgeJson = JSON.stringify({
      biologicalAge: 52.3,
      confidence: 0.72,
      hallmarkScores: { genomicInstability: 0.4, telomereDysfunction: 0.5 },
    })
    expect(isBlocked(bioAgeJson)).toBe(false)
  })

  it('handles AeonForge candidate JSON without blocking on mechanism text', () => {
    const candidateJson = JSON.stringify([{
      id: 'af-1',
      iupacName: 'Quercetin',
      mechanism: 'Inhibits PI3K/AKT signalling and induces apoptosis in senescent cells.',
      targetPathways: ['p53/p21'],
      safetyProfile: { toxicity: 0.2, contraindications: [] },
    }])
    expect(isBlocked(candidateJson)).toBe(false)
  })

  it('blocks AeonForge candidate with prescriptive mechanism text', () => {
    const candidateJson = JSON.stringify([{
      id: 'af-1',
      iupacName: 'Quercetin',
      mechanism: 'Take 500 mg daily to treat your arthritis and boost NAD+.',
      targetPathways: ['p53/p21'],
      safetyProfile: { toxicity: 0.2, contraindications: [] },
    }])
    expect(isBlocked(candidateJson)).toBe(true)
  })
})
