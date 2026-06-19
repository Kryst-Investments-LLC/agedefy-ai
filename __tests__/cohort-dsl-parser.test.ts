import { describe, expect, it } from 'vitest'
import { parseCohortDsl, ParseError } from '@/lib/researcher/cohort-dsl-parser'

describe('cohort-dsl-parser (M3)', () => {
  describe('basic parsing', () => {
    it('parses a minimal COHORT … RETURN statement', () => {
      const q = parseCohortDsl('COHORT RETURN AGG.count()')
      expect(q.filters).toHaveLength(0)
      expect(q.aggregates).toHaveLength(1)
      expect(q.aggregates[0].func).toBe('count')
    })

    it('parses a WHERE clause with a single biomarker filter', () => {
      const q = parseCohortDsl('COHORT WHERE biomarkers.crp.mean < 3.0 RETURN AGG.count()')
      expect(q.filters).toHaveLength(1)
      expect(q.filters[0].field).toBe('biomarkers.crp.mean')
      expect(q.filters[0].operator).toBe('<')
      expect(q.filters[0].value).toBe(3.0)
    })

    it('parses multiple filters joined by AND', () => {
      const q = parseCohortDsl(
        'COHORT WHERE biomarkers.igf1.mean > 150 AND age_bracket >= 40 RETURN AGG.median(biomarkers.igf1)',
      )
      expect(q.filters).toHaveLength(2)
      expect(q.aggregates[0].func).toBe('median')
      expect(q.aggregates[0].field).toBe('biomarkers.igf1')
    })

    it('parses IN operator correctly', () => {
      const q = parseCohortDsl('COHORT WHERE jurisdiction IN ( US DE ) RETURN AGG.count()')
      expect(q.filters[0].operator).toBe('IN')
      expect(q.filters[0].value).toEqual(['US', 'DE'])
    })

    it('parses multiple aggregates', () => {
      const q = parseCohortDsl('COHORT RETURN AGG.count() , AGG.mean(biomarkers.crp)')
      expect(q.aggregates).toHaveLength(2)
      expect(q.aggregates[0].func).toBe('count')
      expect(q.aggregates[1].func).toBe('mean')
    })

    it('parses AGG.percentile with percentile value', () => {
      const q = parseCohortDsl('COHORT RETURN AGG.percentile(biomarkers.crp, 90)')
      expect(q.aggregates[0].func).toBe('percentile')
      expect(q.aggregates[0].percentile).toBe(90)
    })
  })

  describe('error cases', () => {
    it('throws ParseError when query does not start with COHORT', () => {
      expect(() => parseCohortDsl('SELECT * FROM users')).toThrow(ParseError)
    })

    it('throws ParseError when RETURN clause is missing', () => {
      expect(() => parseCohortDsl('COHORT WHERE biomarkers.crp < 3.0')).toThrow(ParseError)
    })

    it('throws ParseError when RETURN has no aggregates', () => {
      expect(() => parseCohortDsl('COHORT RETURN')).toThrow(ParseError)
    })

    it('throws ParseError for unknown aggregate function', () => {
      expect(() => parseCohortDsl('COHORT RETURN AGG.sum(biomarkers.crp)')).toThrow(ParseError)
    })

    it('throws ParseError for disallowed filter field', () => {
      expect(() =>
        parseCohortDsl('COHORT WHERE user_id = 123 RETURN AGG.count()'),
      ).toThrow(ParseError)
    })

    it('throws ParseError for missing operator', () => {
      expect(() =>
        parseCohortDsl('COHORT WHERE biomarkers.crp 3.0 RETURN AGG.count()'),
      ).toThrow(ParseError)
    })
  })

  describe('edge cases', () => {
    it('handles extra whitespace gracefully', () => {
      const q = parseCohortDsl(
        '  COHORT   WHERE   biomarkers.crp.mean   <   3.0   RETURN   AGG.count()  ',
      )
      expect(q.filters[0].value).toBe(3.0)
    })

    it('stores raw DSL in result', () => {
      const dsl = 'COHORT WHERE biomarkers.crp < 3 RETURN AGG.count()'
      const q = parseCohortDsl(dsl)
      expect(q.raw).toBe(dsl)
    })
  })
})
