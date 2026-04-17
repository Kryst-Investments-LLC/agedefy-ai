import type { LabReportParseResult, ParsedLabValue } from './types'

const BIOMARKER_PATTERNS: { name: string; aliases: RegExp; unit: string }[] = [
  { name: 'Glucose', aliases: /glucose|blood\s*sugar|fasting\s*glucose/i, unit: 'mg/dL' },
  { name: 'HbA1c', aliases: /hba1c|hemoglobin\s*a1c|glycated\s*hemoglobin/i, unit: '%' },
  { name: 'Total Cholesterol', aliases: /total\s*cholesterol/i, unit: 'mg/dL' },
  { name: 'LDL', aliases: /ldl[\s-]*c|ldl\s*cholesterol|low[\s-]*density/i, unit: 'mg/dL' },
  { name: 'HDL', aliases: /hdl[\s-]*c|hdl\s*cholesterol|high[\s-]*density/i, unit: 'mg/dL' },
  { name: 'Triglycerides', aliases: /triglycerides?/i, unit: 'mg/dL' },
  { name: 'TSH', aliases: /tsh|thyroid\s*stimulating/i, unit: 'mIU/L' },
  { name: 'Free T4', aliases: /free\s*t4|ft4|thyroxine/i, unit: 'ng/dL' },
  { name: 'Free T3', aliases: /free\s*t3|ft3|triiodothyronine/i, unit: 'pg/mL' },
  { name: 'Vitamin D', aliases: /vitamin\s*d|25[\s-]*oh[\s-]*d|25[\s-]*hydroxy/i, unit: 'ng/mL' },
  { name: 'Vitamin B12', aliases: /vitamin\s*b[\s-]*12|cobalamin/i, unit: 'pg/mL' },
  { name: 'Ferritin', aliases: /ferritin/i, unit: 'ng/mL' },
  { name: 'Iron', aliases: /\biron\b|serum\s*iron/i, unit: 'µg/dL' },
  { name: 'CRP', aliases: /\bcrp\b|c[\s-]*reactive\s*protein|hs[\s-]*crp/i, unit: 'mg/L' },
  { name: 'Testosterone', aliases: /testosterone/i, unit: 'ng/dL' },
  { name: 'Estradiol', aliases: /estradiol|e2/i, unit: 'pg/mL' },
  { name: 'DHEA-S', aliases: /dhea[\s-]*s|dehydroepiandrosterone/i, unit: 'µg/dL' },
  { name: 'Cortisol', aliases: /cortisol/i, unit: 'µg/dL' },
  { name: 'Insulin', aliases: /\binsulin\b|fasting\s*insulin/i, unit: 'µIU/mL' },
  { name: 'Creatinine', aliases: /creatinine/i, unit: 'mg/dL' },
  { name: 'BUN', aliases: /\bbun\b|blood\s*urea\s*nitrogen/i, unit: 'mg/dL' },
  { name: 'eGFR', aliases: /egfr|estimated\s*gfr|glomerular\s*filtration/i, unit: 'mL/min' },
  { name: 'ALT', aliases: /\balt\b|alanine\s*aminotransferase|sgpt/i, unit: 'U/L' },
  { name: 'AST', aliases: /\bast\b|aspartate\s*aminotransferase|sgot/i, unit: 'U/L' },
  { name: 'WBC', aliases: /\bwbc\b|white\s*blood\s*cell/i, unit: 'K/µL' },
  { name: 'RBC', aliases: /\brbc\b|red\s*blood\s*cell/i, unit: 'M/µL' },
  { name: 'Hemoglobin', aliases: /\bhemoglobin\b|\bhgb\b/i, unit: 'g/dL' },
  { name: 'Hematocrit', aliases: /hematocrit|\bhct\b/i, unit: '%' },
  { name: 'Platelets', aliases: /platelets?\b|\bplt\b/i, unit: 'K/µL' },
  { name: 'Magnesium', aliases: /magnesium/i, unit: 'mg/dL' },
  { name: 'Calcium', aliases: /\bcalcium\b/i, unit: 'mg/dL' },
  { name: 'Potassium', aliases: /potassium/i, unit: 'mEq/L' },
  { name: 'Sodium', aliases: /\bsodium\b/i, unit: 'mEq/L' },
  { name: 'IGF-1', aliases: /igf[\s-]*1|insulin[\s-]*like\s*growth/i, unit: 'ng/mL' },
  { name: 'Homocysteine', aliases: /homocysteine/i, unit: 'µmol/L' },
  { name: 'Omega-3 Index', aliases: /omega[\s-]*3\s*index/i, unit: '%' },
  { name: 'ApoB', aliases: /apob|apolipoprotein\s*b/i, unit: 'mg/dL' },
  { name: 'Lp(a)', aliases: /lp\s*\(?\s*a\s*\)?|lipoprotein\s*a/i, unit: 'nmol/L' },
  { name: 'HRV', aliases: /\bhrv\b|heart\s*rate\s*variability/i, unit: 'ms' },
]

const VALUE_PATTERN = /(\d+(?:\.\d+)?)\s*/
const RANGE_PATTERN = /(?:ref(?:erence)?\s*(?:range)?|normal)\s*[:=]?\s*([\d.]+\s*[-–]\s*[\d.]+)/i
const FLAG_PATTERN = /\b(HIGH|LOW|ABNORMAL|NORMAL|H|L)\b/i

function detectFlag(text: string, value: number, refRange?: string): ParsedLabValue['flag'] {
  const flagMatch = text.match(FLAG_PATTERN)
  if (flagMatch) {
    const f = flagMatch[1].toUpperCase()
    if (f === 'H' || f === 'HIGH' || f === 'ABNORMAL') return 'HIGH'
    if (f === 'L' || f === 'LOW') return 'LOW'
    if (f === 'NORMAL') return 'NORMAL'
  }

  if (refRange) {
    const rangeMatch = refRange.match(/([\d.]+)\s*[-–]\s*([\d.]+)/)
    if (rangeMatch) {
      const low = parseFloat(rangeMatch[1])
      const high = parseFloat(rangeMatch[2])
      if (value < low) return 'LOW'
      if (value > high) return 'HIGH'
      return 'NORMAL'
    }
  }

  return undefined
}

function extractDateFromText(text: string): string | undefined {
  const datePatterns = [
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
    /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/,
    /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}/i,
  ]

  for (const pattern of datePatterns) {
    const match = text.match(pattern)
    if (match) return match[0]
  }
  return undefined
}

function extractLabName(text: string): string | undefined {
  const labPatterns = [
    /(?:laboratory|lab|clinic|medical\s*center|health\s*system)\s*[:=]?\s*([^\n]{3,50})/i,
    /^([A-Z][A-Za-z\s&]{2,40}(?:Lab(?:orator(?:y|ies))?|Diagnostics|Health|Medical))/m,
  ]

  for (const pattern of labPatterns) {
    const match = text.match(pattern)
    if (match) return match[1].trim()
  }
  return undefined
}

export function parseLabReportText(text: string): LabReportParseResult {
  const values: ParsedLabValue[] = []
  const lines = text.split('\n')

  for (const line of lines) {
    for (const biomarker of BIOMARKER_PATTERNS) {
      if (!biomarker.aliases.test(line)) continue

      const valueMatch = line.match(
        new RegExp(biomarker.aliases.source + '[\\s:=,]*' + VALUE_PATTERN.source, 'i'),
      )

      if (!valueMatch) {
        const fallback = line.match(VALUE_PATTERN)
        if (fallback) {
          const val = parseFloat(fallback[1])
          if (!isNaN(val) && val > 0 && val < 100000) {
            const rangeMatch = line.match(RANGE_PATTERN)
            const referenceRange = rangeMatch ? rangeMatch[1] : undefined
            values.push({
              name: biomarker.name,
              value: val,
              unit: biomarker.unit,
              referenceRange,
              flag: detectFlag(line, val, referenceRange),
            })
          }
        }
        continue
      }

      const val = parseFloat(valueMatch[valueMatch.length - 1])
      if (isNaN(val) || val <= 0 || val >= 100000) continue

      const rangeMatch = line.match(RANGE_PATTERN)
      const referenceRange = rangeMatch ? rangeMatch[1] : undefined

      values.push({
        name: biomarker.name,
        value: val,
        unit: biomarker.unit,
        referenceRange,
        flag: detectFlag(line, val, referenceRange),
      })
      break
    }
  }

  // Deduplicate — keep the first occurrence of each biomarker
  const seen = new Set<string>()
  const deduped = values.filter((v) => {
    if (seen.has(v.name)) return false
    seen.add(v.name)
    return true
  })

  return {
    values: deduped,
    reportDate: extractDateFromText(text),
    labName: extractLabName(text),
    rawTextLength: text.length,
  }
}
