import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn() } }))

import {
  runTrialScaffolder,
  TRIAL_SCAFFOLD_DISCLAIMER,
} from '@/lib/agents/trial-scaffolder'

const baseInput = {
  hypothesis: 'Rapamycin reduces IGF-1 levels and improves longevity biomarkers in adults over 50.',
  targetBiomarkers: ['igf1', 'crp', 'hba1c'],
  interventionCompoundIds: ['rapamycin'],
  jurisdiction: ['US'],
}

describe('trial-scaffolder (M6)', () => {
  it('returns a valid scaffold for minimal input', async () => {
    const scaffold = await runTrialScaffolder(baseInput)
    expect(scaffold.hypothesis).toBe(baseInput.hypothesis)
    expect(scaffold.disclaimer).toBe(TRIAL_SCAFFOLD_DISCLAIMER)
  })

  it('computes reasonable sample size for medium effect size', async () => {
    const scaffold = await runTrialScaffolder({
      ...baseInput, expectedEffectSize: 0.5, alpha: 0.05, power: 0.80,
    })
    expect(scaffold.powerCalculation.requiredN).toBeGreaterThan(50)
    expect(scaffold.powerCalculation.requiredN).toBeLessThan(200)
  })

  it('computes larger N for small effect size', async () => {
    const s1 = await runTrialScaffolder({ ...baseInput, expectedEffectSize: 0.2 })
    const s2 = await runTrialScaffolder({ ...baseInput, expectedEffectSize: 0.8 })
    expect(s1.powerCalculation.requiredN).toBeGreaterThan(s2.powerCalculation.requiredN)
  })

  it('sets primaryEndpoint to first biomarker', async () => {
    const scaffold = await runTrialScaffolder(baseInput)
    expect(scaffold.primaryEndpoint).toBe('igf1')
  })

  it('includes secondary biomarkers in secondaryEndpoints', async () => {
    const scaffold = await runTrialScaffolder(baseInput)
    expect(scaffold.secondaryEndpoints).toContain('crp')
    expect(scaffold.secondaryEndpoints).toContain('hba1c')
  })

  it('includes standard exclusion criteria', async () => {
    const scaffold = await runTrialScaffolder(baseInput)
    expect(scaffold.exclusionCriteria.some((c) => c.includes('malignancy'))).toBe(true)
    expect(scaffold.exclusionCriteria.some((c) => c.includes('rapamycin'))).toBe(true)
  })

  it('generates a non-empty SHA-256 preregistration hash', async () => {
    const scaffold = await runTrialScaffolder(baseInput)
    expect(scaffold.preregistrationHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('two different hypotheses produce different hashes', async () => {
    const s1 = await runTrialScaffolder({ ...baseInput, hypothesis: 'Hypothesis A is distinct and detailed.' })
    const s2 = await runTrialScaffolder({ ...baseInput, hypothesis: 'Hypothesis B is completely different.' })
    expect(s1.preregistrationHash).not.toBe(s2.preregistrationHash)
  })

  it('includes jurisdiction in IRB boilerplate', async () => {
    const scaffold = await runTrialScaffolder({ ...baseInput, jurisdiction: ['US', 'DE'] })
    expect(scaffold.irbBoilerplate).toContain('US')
    expect(scaffold.irbBoilerplate).toContain('DE')
  })

  it('marks boilerplate as AI-generated', async () => {
    const scaffold = await runTrialScaffolder(baseInput)
    expect(scaffold.irbBoilerplate).toContain('AI-generated')
  })

  it('generates R analysis script with primary endpoint variable', async () => {
    const scaffold = await runTrialScaffolder(baseInput)
    expect(scaffold.analysisScriptTemplate).toContain('igf1')
    expect(scaffold.analysisScriptTemplate).toContain('lmer')
  })

  it('uses power calculation method simplified_bayesian_approximation', async () => {
    const scaffold = await runTrialScaffolder(baseInput)
    expect(scaffold.powerCalculation.method).toBe('simplified_bayesian_approximation')
    expect(scaffold.powerCalculation.note).toMatch(/biostatistician/)
  })
})
