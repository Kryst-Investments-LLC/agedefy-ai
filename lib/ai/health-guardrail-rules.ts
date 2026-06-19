/**
 * =============================================================================
 * HEALTH GUARDRAIL RULES — MEDICAL REVIEWER CONFIGURATION
 * =============================================================================
 *
 * This file is the ONLY place you need to edit to change what the AI health
 * guardrail blocks or flags. It is intentionally separated from the logic so
 * a medical, clinical, or compliance reviewer can update rules without touching
 * application code. Changes here take effect on the next deploy.
 *
 * WHO SHOULD EDIT THIS FILE
 * -------------------------
 * Medical advisor, compliance officer, or clinical safety reviewer.
 * Developers should not change pattern logic here without clinical sign-off.
 *
 * HOW TO ADD A RULE
 * -----------------
 * 1. Find the relevant category below, or create a new GuardrailCategory entry.
 * 2. Add a RegExp to the `patterns` array. Use the /i flag (case-insensitive).
 *    Anchors and word-boundaries (\b) prevent partial-word false positives.
 * 3. Add a plain-text example to `examples` so future reviewers know what
 *    you intended the pattern to catch.
 * 4. Run the test suite: pnpm vitest run __tests__/health-guardrail.test.ts
 *    Add new test cases to cover the pattern.
 *
 * PATTERN PHILOSOPHY
 * ------------------
 * Block: PRESCRIPTIVE language directed at the user — "take X mg",
 *        "you should start", "prescribe", "this will cure your cancer".
 * Pass:  INFORMATIONAL language about research — "studies used 500 mg",
 *        "clinical trials explored", "the compound has been shown to".
 *
 * SEVERITY
 * --------
 * "block" — Replace entire response with CLINICIAN_REDIRECT_RESPONSE.
 *            Use for dosing instructions, prescription directives, cure claims.
 * (Future: "flag" — soft-warn mode, reserved but not yet wired up.)
 * =============================================================================
 */

// ---------------------------------------------------------------------------
// Category type
// ---------------------------------------------------------------------------

export interface GuardrailCategory {
  /** Machine-readable identifier used in audit logs and test assertions. */
  name: string
  /** Human-readable description for the medical reviewer. */
  description: string
  /** A match on ANY pattern in this array triggers a block. */
  patterns: RegExp[]
  /** Plain-text examples to document scope for future reviewers. */
  examples: string[]
}

// ---------------------------------------------------------------------------
// Blocked categories
// ---------------------------------------------------------------------------

export const GUARDRAIL_CATEGORIES: GuardrailCategory[] = [
  // -------------------------------------------------------------------------
  // 1. SPECIFIC DOSING INSTRUCTIONS
  //    Catches prescriptive dosing language directed at the user.
  //    DOES NOT block informational dosing mentions in research context
  //    ("studies used 500 mg", "the RCT administered 1 g").
  // -------------------------------------------------------------------------
  {
    name: 'specific-dosing',
    description:
      'Prescriptive dosing instructions directed at the user — ' +
      '"take 500 mg", "your dose should be", "titrate to X mg", "start with X mg".',
    patterns: [
      // "take 500 mg", "give 200 mcg"
      /\b(?:take|give)\s+\d+[\s-]*(?:mg|mcg|µg|g(?!\w)|ml|units?|IU)\b/i,
      // "X mg daily", "X mg twice daily", "X mg per day"
      /\b\d+[\s-]*(?:mg|mcg|µg|g(?!\w)|ml|units?|IU)[\s,]+(?:once|twice|three\s+times?|\d+\s+times?)\s+(?:a\s+|per\s+)?(?:day|daily|week|weekly)\b/i,
      // "X mg per day" / "X mg/day"
      /\b\d+[\s-]*(?:mg|mcg|µg|g(?!\w)|ml|units?|IU)\s+per\s+(?:day|week)\b/i,
      // "your dose is", "your dosage should be", "the recommended dose is"
      /\b(?:your|the\s+recommended|the\s+correct|the\s+optimal)\s+(?:dose|dosage)\s+(?:is|should\s+be)\b/i,
      // "titrate to 1000 mg", "titrate up to"
      /\btitrate\s+(?:up\s+)?to\s+\d+/i,
      // "start at 500 mg", "begin with 200 mg"
      /\b(?:start|begin)\s+(?:with\s+|at\s+)\d+[\s-]*(?:mg|mcg|g(?!\w)|ml)\b/i,
    ],
    examples: [
      'Take 500 mg of metformin twice daily.',
      'Give 200 mcg of rapamycin weekly.',
      'Your dose should be 1000 mg.',
      'The recommended dosage is 100 mg per day.',
      'Titrate up to 1000 mg over four weeks.',
      'Start at 100 mg and increase gradually.',
    ],
  },

  // -------------------------------------------------------------------------
  // 2. PRESCRIPTION DIRECTIVES
  //    Catches language implying prescribing authority or personal medical
  //    orders to the user. "You should take" / "stop your medication" /
  //    "I prescribe" / "write a prescription".
  // -------------------------------------------------------------------------
  {
    name: 'prescription-directive',
    description:
      'Language that implies a prescription is being issued or a personal ' +
      'medical directive given — "prescribe", "you should take/stop", ' +
      '"write a prescription", "stop your medication".',
    patterns: [
      // "prescribe", "prescribed", "prescribing"
      /\bprescrib(?:e|es|ed|ing)\b/i,
      // "write a prescription", "write you a prescription"
      /\bwrite\s+(?:(?:you\s+)?a\s+)?prescription\b/i,
      // "you should take/start/use/stop/increase/decrease/reduce X"
      /\byou\s+should\s+(?:take|start|use|stop|avoid|increase|decrease|reduce)\b/i,
      // "you must take / you need to start"
      /\byou\s+(?:must|need\s+to)\s+(?:take|start|stop|use)\b/i,
      // "stop your medication", "discontinue your current treatment", "switch your therapy"
      /\b(?:stop|discontinue|change|switch)\s+(?:taking\s+)?(?:your\s+(?:\w+\s+){0,2})?(?:medication|drug|treatment|therapy|supplement)\b/i,
      // "replace your medication/drug/current treatment"
      /\breplace\s+(?:your\s+)?(?:medication|current\s+treatment|drug)\b/i,
    ],
    examples: [
      'I prescribe metformin 500 mg for this patient.',
      'You should take rapamycin weekly.',
      'Stop taking your medication immediately.',
      'Write a prescription for berberine.',
      'You must start this treatment today.',
      'Replace your current medication with NMN.',
    ],
  },

  // -------------------------------------------------------------------------
  // 3. DISEASE-TREATMENT CLAIMS
  //    Catches unqualified cure claims or prescriptive disease-treatment
  //    directives. DOES NOT block informational research framing
  //    ("X has been studied as a potential treatment for Y in animal models").
  // -------------------------------------------------------------------------
  {
    name: 'disease-treatment-claim',
    description:
      'Claims that a compound will cure, or prescriptive "use this to treat ' +
      'your [disease]" language. Does not block research-context treatment ' +
      'mentions ("studied as a potential treatment for").',
    patterns: [
      // "will cure", "can cure", "cures cancer", "this cures"
      /\b(?:will\s+|can\s+|this\s+|it\s+)?cures?\b/i,
      // "treats your [named condition]" — second-person, prescriptive
      /\btreat(?:s|ing)\s+(?:your\s+|the\s+)?(?:diabetes|cancer|alzheimer|parkinson|hypertension|heart\s+disease|depression|anxiety|arthritis|autoimmune)\b/i,
      // "use this to treat" / "use it to treat"
      /\buse\s+(?:this|it)\s+to\s+treat\b/i,
      // "clinically proven treatment/therapy/cure/remedy"
      /\bclinically\s+proven\s+(?:treatment|therapy|cure|remedy)\b/i,
      // "FDA-approved to treat / for the treatment of / for treating"
      /\bFDA[- ]approved\s+(?:to\s+treat|for\s+(?:the\s+)?treatment\s+of|for\s+treating)\b/i,
    ],
    examples: [
      'This compound will cure Alzheimer\'s disease.',
      'Fisetin cures cancer.',
      'Use this to treat your arthritis.',
      'This is a clinically proven treatment for hypertension.',
      'This drug is FDA-approved for treating type 2 diabetes.',
      'It treats your diabetes better than metformin.',
    ],
  },
]

// ---------------------------------------------------------------------------
// Redirect response
// Shown to the user in place of any blocked content.
// Medical reviewer: adjust wording here as needed.
// ---------------------------------------------------------------------------

export const CLINICIAN_REDIRECT_RESPONSE =
  'This response has been withheld because it may contain specific dosing, ' +
  'prescription, or disease-treatment guidance that is outside the scope of ' +
  'this platform.\n\n' +
  'Please consult a licensed clinician, physician, or pharmacist before ' +
  'making any changes to your medications, supplements, or treatment ' +
  'protocols.\n\n' +
  'For general longevity research information, rephrase your question to ' +
  'focus on published research, mechanisms of action, or evidence summaries ' +
  'rather than personal medical guidance.'

// ---------------------------------------------------------------------------
// Persistent "not medical advice" disclaimer
// ALWAYS attached to every health AI response — blocked or not.
// Medical reviewer: this is the persistent frame the spec requires.
// ---------------------------------------------------------------------------

export const NOT_MEDICAL_ADVICE_DISCLAIMER =
  'Not medical advice. This information is for educational and research ' +
  'purposes only and does not constitute medical advice, diagnosis, or ' +
  'treatment recommendations. Always consult a qualified healthcare provider ' +
  'before making any health or medication decisions.'
