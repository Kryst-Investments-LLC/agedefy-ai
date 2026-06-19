/**
 * Cohort DSL Parser — Moat M3
 *
 * Parses a simple SQL-like DSL into an AST for safe cohort queries.
 *
 * Grammar (simplified):
 *   query     := "COHORT" filters "RETURN" aggregates
 *   filters   := "WHERE" condition ("AND" condition)*
 *   condition := field operator value
 *   field     := "biomarkers." name "." agg | "protocols" "CONTAINS" string
 *              | "user.consent" | "jurisdiction" "IN" "(" strlist ")"
 *              | "age_bracket" op number | "sex" "=" string
 *   aggregates := agg_expr ("," agg_expr)*
 *   agg_expr  := "AGG." func "(" field ")"
 *
 * Only aggregate returns are allowed — no row-level data access.
 *
 * Examples:
 *   COHORT WHERE biomarkers.crp.mean < 3.0 AND age_bracket >= 40
 *   RETURN AGG.median(biomarkers.crp), AGG.count()
 */

export type FilterOperator = "=" | "!=" | "<" | "<=" | ">" | ">=" | "IN" | "CONTAINS"
export type AggFunc = "median" | "mean" | "count" | "percentile"

export interface FilterNode {
  type: "filter"
  field: string
  operator: FilterOperator
  value: string | number | string[]
}

export interface AggregateNode {
  type: "aggregate"
  func: AggFunc
  field: string | null   // null for AGG.count()
  alias?: string
  percentile?: number   // only for AGG.percentile
}

export interface CohortQuery {
  filters: FilterNode[]
  aggregates: AggregateNode[]
  raw: string
}

export class ParseError extends Error {
  constructor(message: string, public at: number = 0) {
    super(`CohortDSL parse error at position ${at}: ${message}`)
    this.name = "ParseError"
  }
}

const ALLOWED_FILTER_FIELDS = new Set([
  "biomarkers", "protocols", "user.consent", "jurisdiction", "age_bracket", "sex",
])

const ALLOWED_AGG_FUNCS: AggFunc[] = ["median", "mean", "count", "percentile"]

function tokenize(dsl: string): string[] {
  // Split on whitespace and common punctuation while keeping them as tokens
  return dsl
    .replace(/\(/g, " ( ")
    .replace(/\)/g, " ) ")
    .replace(/,/g, " , ")
    .split(/\s+/)
    .filter(Boolean)
}

function parseValue(token: string): string | number {
  const n = parseFloat(token)
  return isNaN(n) ? token.replace(/^["']|["']$/g, "") : n
}

function parseAggExpr(tokens: string[], pos: number): { node: AggregateNode; pos: number } {
  // Expect: AGG.func ( field? )
  const aggToken = tokens[pos] ?? ""
  if (!aggToken.startsWith("AGG.")) throw new ParseError(`Expected AGG.func, got "${aggToken}"`, pos)

  const funcRaw = aggToken.slice(4).toLowerCase()
  if (!ALLOWED_AGG_FUNCS.includes(funcRaw as AggFunc)) {
    throw new ParseError(`Unknown aggregate function "${funcRaw}". Allowed: ${ALLOWED_AGG_FUNCS.join(", ")}`)
  }

  pos++
  if (tokens[pos] !== "(") throw new ParseError(`Expected ( after AGG.${funcRaw}`, pos)
  pos++

  let field: string | null = null
  let percentile: number | undefined

  if (tokens[pos] !== ")") {
    if (funcRaw === "percentile") {
      // AGG.percentile(field, p)
      field = tokens[pos++]
      if (tokens[pos] === ",") {
        pos++
        percentile = parseFloat(tokens[pos++])
      }
    } else {
      field = tokens[pos++]
    }
  }

  if (tokens[pos] !== ")") throw new ParseError(`Expected ) to close AGG.${funcRaw}`, pos)
  pos++

  return {
    node: { type: "aggregate", func: funcRaw as AggFunc, field, percentile },
    pos,
  }
}

function parseFilterCondition(tokens: string[], pos: number): { node: FilterNode; pos: number } {
  const field = tokens[pos++]
  if (!field) throw new ParseError("Expected filter field", pos)

  // Validate field root
  const fieldRoot = field.split(".")[0]
  if (!ALLOWED_FILTER_FIELDS.has(fieldRoot) && !ALLOWED_FILTER_FIELDS.has(field)) {
    throw new ParseError(`Disallowed filter field "${field}". Allowed roots: ${[...ALLOWED_FILTER_FIELDS].join(", ")}`)
  }

  const opToken = (tokens[pos] ?? "").toUpperCase()
  const OPERATORS: FilterOperator[] = ["<=", ">=", "!=", "<", ">", "=", "IN", "CONTAINS"]
  const operator = OPERATORS.find((op) => op === opToken || op === tokens[pos])

  if (!operator) throw new ParseError(`Expected operator, got "${tokens[pos]}"`, pos)
  pos++

  let value: string | number | string[]

  if (operator === "IN") {
    // IN ( val, val, ... )
    if (tokens[pos] !== "(") throw new ParseError("Expected ( after IN", pos)
    pos++
    const vals: string[] = []
    while (tokens[pos] && tokens[pos] !== ")") {
      if (tokens[pos] !== ",") vals.push(tokens[pos].replace(/^["']|["']$/g, ""))
      pos++
    }
    if (tokens[pos] !== ")") throw new ParseError("Expected ) to close IN list", pos)
    pos++
    value = vals
  } else {
    value = parseValue(tokens[pos++])
  }

  return { node: { type: "filter", field, operator, value }, pos }
}

export function parseCohortDsl(dsl: string): CohortQuery {
  const trimmed = dsl.trim()
  const tokens = tokenize(trimmed)
  let pos = 0

  if ((tokens[pos] ?? "").toUpperCase() !== "COHORT") {
    throw new ParseError(`Query must start with COHORT, got "${tokens[pos]}"`)
  }
  pos++

  const filters: FilterNode[] = []

  if ((tokens[pos] ?? "").toUpperCase() === "WHERE") {
    pos++
    while (pos < tokens.length && (tokens[pos] ?? "").toUpperCase() !== "RETURN") {
      const { node, pos: nextPos } = parseFilterCondition(tokens, pos)
      filters.push(node)
      pos = nextPos
      if ((tokens[pos] ?? "").toUpperCase() === "AND") pos++
    }
  }

  if ((tokens[pos] ?? "").toUpperCase() !== "RETURN") {
    throw new ParseError(`Expected RETURN clause, got "${tokens[pos]}"`, pos)
  }
  pos++

  const aggregates: AggregateNode[] = []
  while (pos < tokens.length) {
    const { node, pos: nextPos } = parseAggExpr(tokens, pos)
    aggregates.push(node)
    pos = nextPos
    if (tokens[pos] === ",") pos++
  }

  if (aggregates.length === 0) throw new ParseError("RETURN clause must have at least one AGG expression")

  return { filters, aggregates, raw: trimmed }
}
