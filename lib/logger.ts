type LogLevel = "debug" | "info" | "warn" | "error"

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  [key: string]: unknown
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const minLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel | undefined) ?? "info"

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel]
}

// Keys whose values are PII/secrets and must never reach the log stream.
// Redaction is by key name and is depth-bounded, so callers can pass structured
// meta without leaking (e.g. { user: { email } } -> { user: { email: "[redacted]" } }).
const SENSITIVE_KEY = /(email|password|passwd|token|secret|authorization|cookie|api[-_]?key|ssn|dob|phone|address)/i
const MAX_REDACT_DEPTH = 4

function redactValue(value: unknown, depth: number): unknown {
  if (depth > MAX_REDACT_DEPTH || value === null || typeof value !== "object") {
    return value
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, depth + 1))
  }
  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : redactValue(val, depth + 1)
  }
  return out
}

function emit(entry: LogEntry): void {
  // Structured JSON to stdout/stderr – compatible with any log collector
  const out = entry.level === "error" ? process.stderr : process.stdout
  out.write(JSON.stringify(entry) + "\n")
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (!shouldLog(level)) return
  const safeMeta = meta ? (redactValue(meta, 0) as Record<string, unknown>) : undefined
  emit({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...safeMeta,
  })
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => log("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>) => log("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log("error", message, meta),
}
