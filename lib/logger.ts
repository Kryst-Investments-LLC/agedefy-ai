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

function emit(entry: LogEntry): void {
  // Structured JSON to stdout/stderr – compatible with any log collector
  const out = entry.level === "error" ? process.stderr : process.stdout
  out.write(JSON.stringify(entry) + "\n")
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (!shouldLog(level)) return
  emit({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  })
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => log("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>) => log("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log("error", message, meta),
}
