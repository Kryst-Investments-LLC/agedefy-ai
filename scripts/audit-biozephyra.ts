import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

type CheckResult = {
  name: string
  passed: boolean
  details?: string
}

type SectionResult = {
  section: string
  checks: CheckResult[]
}

type SearchResult = {
  found: boolean
  matches: string[]
}

type AIEnvProfile = "mock-development" | "provider-production" | "inconsistent"

const TEXT_SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".env",
])

function logHeader(title: string) {
  console.log(`\n=== ${title} ===`)
}

function printCheckResult(result: CheckResult) {
  console.log(result.passed ? "✅" : "❌", result.name, result.details ? `\n   → ${result.details}` : "")
}

function escapeMarkdown(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/\*/g, "\\*")
}

function toAbsolute(relPath: string) {
  return path.join(process.cwd(), relPath)
}

function pathExists(relPath: string): CheckResult {
  const full = toAbsolute(relPath)
  const exists = fs.existsSync(full)

  return {
    name: `Path exists: ${relPath}`,
    passed: exists,
    details: exists ? "" : `Missing path: ${relPath}`,
  }
}

function normalizeEnvValue(value: string) {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function loadEnvFile(filename: string): Record<string, string> {
  const full = toAbsolute(filename)
  if (!fs.existsSync(full)) return {}

  const content = fs.readFileSync(full, "utf8")
  const env: Record<string, string> = {}

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const idx = trimmed.indexOf("=")
    if (idx === -1) continue

    const key = trimmed.slice(0, idx).trim()
    const value = normalizeEnvValue(trimmed.slice(idx + 1))
    env[key] = value
  }

  return env
}

function isPlaceholderEnvValue(value: string | undefined) {
  if (!value) return true

  const normalized = value.trim().toLowerCase()
  if (!normalized) return true

  return [
    "your_",
    "sk-...",
    "<your",
    "changeme",
    "replace_me",
    "example",
    "placeholder",
  ].some((marker) => normalized.includes(marker))
}

function checkRequiredEnv(
  env: Record<string, string>,
  required: string[],
  name: string,
): CheckResult {
  const missing = required.filter((key) => isPlaceholderEnvValue(env[key]))

  return {
    name: `Env: ${name} required variables`,
    passed: missing.length === 0,
    details:
      missing.length === 0
        ? ""
        : `Missing or placeholder env vars in ${name}: ${missing.join(", ")}`,
  }
}

function checkBooleanEnv(
  env: Record<string, string>,
  expectations: { key: string; expected: "true" | "false" }[],
  name: string,
): CheckResult {
  const mismatches: string[] = []

  for (const { key, expected } of expectations) {
    const actual = env[key]
    if (!actual) {
      mismatches.push(`${key}=<missing> (expected ${expected})`)
    } else if (actual !== expected) {
      mismatches.push(`${key}=${actual} (expected ${expected})`)
    }
  }

  return {
    name: `Env: ${name}`,
    passed: mismatches.length === 0,
    details: mismatches.length > 0 ? mismatches.join("; ") : "",
  }
}

function getProfileAwareResult(profile: AIEnvProfile, failedChecks: number) {
  if (profile === "mock-development") {
    return {
      overallResult: "FAIL (mock-development)",
      consoleSummary:
        "\nLevel 4 AI integration check: ❌ Mock-development profile detected. Configure a real provider-backed profile with at least one enabled provider and live API keys before declaring readiness.",
      reportSummary:
        "> Result: ❌ Mock-development profile detected. Configure a provider-backed profile with at least one enabled provider and real API keys before declaring readiness.",
    }
  }

  if (profile !== "provider-production") {
    return {
      overallResult: "FAIL",
      consoleSummary:
        "\nLevel 4 AI integration check: ❌ The environment profile is inconsistent. Resolve the profile mismatch before calling this AI layer production-grade.",
      reportSummary:
        "> Result: ❌ The environment profile is inconsistent. Resolve the profile mismatch before declaring Level-4 production readiness.",
    }
  }

  if (failedChecks > 0) {
    return {
      overallResult: "FAIL",
      consoleSummary:
        "\nLevel 4 AI integration check: ❌ Some checks failed. Resolve the failures above before calling this AI layer fully production-grade.",
      reportSummary:
        "> Result: ❌ Some checks failed. Resolve the failed items above before declaring Level-4 production readiness.",
    }
  }

  return {
    overallResult: "PASS (provider-production)",
    consoleSummary:
      "\nLevel 4 AI integration check: ✅ All scripted checks passed for a provider-backed profile. This AI layer is structurally production-ready, subject to human review for UX, compliance, and observability depth.",
    reportSummary:
      "> Result: ✅ All scripted checks passed for a provider-backed profile. This AI layer is structurally Level-4 production-ready, subject to human review for UX, compliance, and observability depth.",
  }
}

function checkExplicitEnvFlags(
  env: Record<string, string>,
  keys: string[],
  name: string,
): CheckResult {
  const missing = keys.filter((key) => !(key in env))

  return {
    name: `Env: ${name} explicit AI flags`,
    passed: missing.length === 0,
    details:
      missing.length === 0
        ? `Explicitly configured ${keys.length} AI-related env flags.`
        : `Missing explicit env flags in ${name}: ${missing.join(", ")}`,
  }
}

function getEnabledAIProviders(env: Record<string, string>) {
  return [
    { name: "openai", enabledKey: "NEXT_PUBLIC_ENABLE_CHATGPT", apiKey: "OPENAI_API_KEY" },
    { name: "grok", enabledKey: "NEXT_PUBLIC_ENABLE_GROK", apiKey: "GROK_API_KEY" },
    { name: "anthropic", enabledKey: "NEXT_PUBLIC_ENABLE_ANTHROPIC", apiKey: "ANTHROPIC_API_KEY" },
  ].filter((provider) => env[provider.enabledKey] === "true")
}

function detectAIEnvProfile(env: Record<string, string>): {
  profile: AIEnvProfile
  details: string
} {
  const useMockData = env.NEXT_PUBLIC_USE_MOCK_DATA
  const debugMode = env.NEXT_PUBLIC_DEBUG_MODE
  const aiFeaturesEnabled = env.NEXT_PUBLIC_ENABLE_AI_FEATURES
  const enabledProviders = getEnabledAIProviders(env)

  if (debugMode !== "false") {
    return {
      profile: "inconsistent",
      details: `NEXT_PUBLIC_DEBUG_MODE must be false for a readiness check, received ${debugMode ?? "<missing>"}.`,
    }
  }

  if (useMockData === "true") {
    const invalidFlags: string[] = []

    if (aiFeaturesEnabled !== "false") {
      invalidFlags.push(`NEXT_PUBLIC_ENABLE_AI_FEATURES=${aiFeaturesEnabled ?? "<missing>"} (expected false in mock mode)`)
    }

    if (enabledProviders.length > 0) {
      invalidFlags.push(`provider flags enabled in mock mode: ${enabledProviders.map((provider) => provider.name).join(", ")}`)
    }

    return {
      profile: invalidFlags.length === 0 ? "mock-development" : "inconsistent",
      details:
        invalidFlags.length === 0
          ? "Mock-data development profile detected: AI providers disabled, mock data enabled, debug mode off."
          : invalidFlags.join("; "),
    }
  }

  if (useMockData === "false") {
    if (aiFeaturesEnabled !== "true") {
      return {
        profile: "inconsistent",
        details: `NEXT_PUBLIC_ENABLE_AI_FEATURES must be true when NEXT_PUBLIC_USE_MOCK_DATA=false, received ${aiFeaturesEnabled ?? "<missing>"}.`,
      }
    }

    if (enabledProviders.length === 0) {
      return {
        profile: "inconsistent",
        details: "Production provider mode requires at least one enabled AI provider flag.",
      }
    }

    return {
      profile: "provider-production",
      details: `Provider-backed production profile detected with enabled providers: ${enabledProviders
        .map((provider) => provider.name)
        .join(", ")}.`,
    }
  }

  return {
    profile: "inconsistent",
    details: `NEXT_PUBLIC_USE_MOCK_DATA must be explicitly set to true or false, received ${useMockData ?? "<missing>"}.`,
  }
}

function checkAIEnvProfile(env: Record<string, string>, name: string): CheckResult {
  const { profile, details } = detectAIEnvProfile(env)

  return {
    name: `Env: ${name} provider-backed AI operating profile`,
    passed: profile === "provider-production",
    details:
      profile === "provider-production"
        ? details
        : profile === "mock-development"
          ? "Mock-development profile detected. Real readiness now requires NEXT_PUBLIC_USE_MOCK_DATA=false, NEXT_PUBLIC_ENABLE_AI_FEATURES=true, at least one enabled provider flag, and its configured API key."
          : details,
  }
}

function checkProviderEnvConsistency(env: Record<string, string>, name: string): CheckResult {
  const { profile } = detectAIEnvProfile(env)

  if (profile === "mock-development") {
    return {
      name: `Env: ${name} provider key consistency`,
      passed: false,
      details:
        "Real readiness requires a provider-backed profile with at least one enabled provider and a configured API key. Mock-data mode is not accepted for a readiness pass.",
    }
  }

  const enabledProviders = getEnabledAIProviders(env)
  const missingKeys = enabledProviders
    .filter((provider) => isPlaceholderEnvValue(env[provider.apiKey]))
    .map((provider) => `${provider.apiKey} for ${provider.name}`)

  return {
    name: `Env: ${name} provider key consistency`,
    passed: missingKeys.length === 0,
    details:
      missingKeys.length === 0
        ? `Validated API keys for enabled providers: ${enabledProviders.map((provider) => provider.name).join(", ")}.`
        : `Enabled provider keys missing or placeholder in ${name}: ${missingKeys.join(", ")}`,
  }
}

function isTextSourceFile(fileName: string) {
  return TEXT_SOURCE_EXTENSIONS.has(path.extname(fileName).toLowerCase())
}

function collectFiles(
  relPath: string,
  fileFilter: (fileName: string) => boolean = isTextSourceFile,
): string[] {
  const fullPath = toAbsolute(relPath)
  if (!fs.existsSync(fullPath)) return []

  const stat = fs.statSync(fullPath)
  if (stat.isFile()) {
    return fileFilter(fullPath) ? [fullPath] : []
  }

  const files: string[] = []

  function walk(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true })
    for (const entry of entries) {
      const nextPath = path.join(currentPath, entry.name)
      if (entry.isDirectory()) {
        walk(nextPath)
      } else if (entry.isFile() && fileFilter(entry.name)) {
        files.push(nextPath)
      }
    }
  }

  walk(fullPath)
  return files
}

function checkSourceContains(
  relPath: string,
  patterns: string[],
  label: string,
): CheckResult {
  const files = collectFiles(relPath)
  if (files.length === 0) {
    return {
      name: `Source check: ${label}`,
      passed: false,
      details: `Path not found or no matching source files: ${relPath}`,
    }
  }

  const missing: string[] = []
  for (const pattern of patterns) {
    const found = files.some((file) => fs.readFileSync(file, "utf8").includes(pattern))
    if (!found) missing.push(pattern)
  }

  return {
    name: `Source check: ${label}`,
    passed: missing.length === 0,
    details:
      missing.length === 0
        ? `Validated ${patterns.length} pattern(s) across ${files.length} file(s) under ${relPath}`
        : `Missing patterns: ${missing.join(", ")}`,
  }
}

function searchInPaths(
  relPaths: string[],
  fileFilter: (file: string) => boolean,
  patterns: string[],
): SearchResult {
  const matches: string[] = []

  for (const relPath of relPaths) {
    const files = collectFiles(relPath, fileFilter)
    for (const fullFile of files) {
      const content = fs.readFileSync(fullFile, "utf8")
      const fileMatches = patterns
        .filter((pattern) => content.includes(pattern))
        .map((pattern) => `${path.relative(process.cwd(), fullFile)} → "${pattern}"`)
      matches.push(...fileMatches)
    }
  }

  return {
    found: matches.length > 0,
    matches,
  }
}

function checkRateLimitingForAI(): CheckResult {
  const { found, matches } = searchInPaths(
    ["app/api/ai"],
    isTextSourceFile,
    ["applyRateLimit(", "rateLimit", "rateLimiter", "limiter", "Ratelimit", "Ratelimiter"],
  )

  return {
    name: "Rate limiting on app/api/ai/**",
    passed: found,
    details: found
      ? `Found rate limiting references:\n${matches.join("\n")}`
      : "No obvious rate limiting references found under app/api/ai. Ensure AI routes are protected against abuse.",
  }
}

function checkObservabilityHooks(): CheckResult {
  const routePatterns = [
    "logRequestEvent(",
    "logger.",
    "enqueueGovernedAIAuditJob(",
    "createRequestContext(",
  ]
  const routeFiles = collectFiles("app/api/ai")
  const routeMatches: string[] = []
  const missingRouteFiles: string[] = []

  for (const fullFile of routeFiles) {
    const content = fs.readFileSync(fullFile, "utf8")
    const matchingPatterns = routePatterns.filter((pattern) => content.includes(pattern))

    if (matchingPatterns.length === 0) {
      missingRouteFiles.push(path.relative(process.cwd(), fullFile))
      continue
    }

    routeMatches.push(
      ...matchingPatterns.map((pattern) => `${path.relative(process.cwd(), fullFile)} → "${pattern}"`),
    )
  }

  const requestContextCheck = checkSourceContains(
    "lib/observability/request-context.ts",
    ["createRequestContext(", "logRequestEvent("],
    "AI request context helpers",
  )
  const governanceCheck = checkSourceContains(
    "lib/jobs/ai-governance.ts",
    ["enqueueGovernedAIAuditJob("],
    "AI governance queue hook",
  )
  const aeonforgeServiceMatches = searchInPaths(
    ["lib/services/aeonforge.ts"],
    isTextSourceFile,
    ["logger."],
  )

  const failures: string[] = []
  if (routeFiles.length === 0) {
    failures.push("No AI route source files found under app/api/ai.")
  }
  if (missingRouteFiles.length > 0) {
    failures.push(`Missing observability/governance hooks in AI routes: ${missingRouteFiles.join(", ")}`)
  }
  if (!requestContextCheck.passed && requestContextCheck.details) {
    failures.push(requestContextCheck.details)
  }
  if (!governanceCheck.passed && governanceCheck.details) {
    failures.push(governanceCheck.details)
  }

  return {
    name: "Observability/logging hooks for AI",
    passed:
      routeFiles.length > 0 &&
      missingRouteFiles.length === 0 &&
      requestContextCheck.passed &&
      governanceCheck.passed,
    details:
      failures.length > 0
        ? failures.join("; ")
        : `Found AI-specific observability/logging references:\n${[
            ...routeMatches,
            ...aeonforgeServiceMatches.matches,
            `lib/observability/request-context.ts → \"createRequestContext(\"`,
            `lib/observability/request-context.ts → \"logRequestEvent(\"`,
            `lib/jobs/ai-governance.ts → \"enqueueGovernedAIAuditJob(\"`,
          ].join("\n")}`,
  }
}

function detectPackageManager(): "pnpm" | "npm" {
  return fs.existsSync(toAbsolute("pnpm-lock.yaml")) ? "pnpm" : "npm"
}

function runCommand(cmd: string, args: string[], label: string): CheckResult {
  console.log(`\n$ ${cmd} ${args.join(" ")}`)

  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    cwd: process.cwd(),
  })

  return {
    name: `Command: ${label}`,
    passed: result.status === 0,
    details:
      result.status === 0
        ? ""
        : `${cmd} ${args.join(" ")} exited with code ${result.status}`,
  }
}

function runPackageScript(scriptName: string): CheckResult {
  const packageManager = detectPackageManager()
  return packageManager === "pnpm"
    ? runCommand("pnpm", [scriptName], `${packageManager} ${scriptName}`)
    : runCommand("npm", ["run", scriptName], `${packageManager} run ${scriptName}`)
}

function generateMarkdownReport(sections: SectionResult[], profile: AIEnvProfile) {
  const packageManager = detectPackageManager()
  const reportPath = toAbsolute("biozephyra-level4-report.md")
  const lines: string[] = []
  const failedChecks: Array<{ section: string; check: CheckResult }> = []

  lines.push("# Biozephyra AI - Level 4 Readiness Report")
  lines.push("")
  lines.push(`Generated at: ${new Date().toISOString()}`)
  lines.push(`Package manager detected: ${packageManager}`)
  lines.push("")

  let totalPassed = 0
  let totalFailed = 0

  for (const section of sections) {
    for (const check of section.checks) {
      if (check.passed) {
        totalPassed++
      } else {
        totalFailed++
        failedChecks.push({ section: section.section, check })
      }
    }
  }

  const profileAwareResult = getProfileAwareResult(profile, totalFailed)

  lines.push("## Summary")
  lines.push("")
  lines.push("| Metric | Value |")
  lines.push("| --- | --- |")
  lines.push(`| Profile | ${profile} |`)
  lines.push(`| Passed | ${totalPassed} |`)
  lines.push(`| Failed | ${totalFailed} |`)
  lines.push(`| Overall Result | ${profileAwareResult.overallResult} |`)
  lines.push("")

  if (failedChecks.length > 0) {
    lines.push("### Failed Checks")
    lines.push("")
    for (const { section, check } of failedChecks) {
      lines.push(`- **${escapeMarkdown(section)}**: ${escapeMarkdown(check.name)}`)
    }
    lines.push("")
  }

  for (const section of sections) {
    lines.push(`## ${section.section}`)
    lines.push("")
    for (const check of section.checks) {
      const icon = check.passed ? "✅" : "❌"
      lines.push(`- ${icon} **${escapeMarkdown(check.name)}**`)
      if (check.details) {
        if (check.details.includes("\n")) {
          lines.push("")
          lines.push("```text")
          lines.push(check.details)
          lines.push("```")
        } else {
          lines.push(`  - ${check.details}`)
        }
      }
    }
    lines.push("")
  }

  lines.push("---")
  lines.push("")
  lines.push(`**Total Passed:** ${totalPassed}`)
  lines.push(`**Total Failed:** ${totalFailed}`)
  lines.push("")

  lines.push(profileAwareResult.reportSummary)

  fs.writeFileSync(reportPath, lines.join("\n"), "utf8")
  console.log(`\nMarkdown report written to: ${reportPath}`)
}

function main() {
  const packageManager = detectPackageManager()
  const sections: SectionResult[] = []

  logHeader("STRUCTURE & CONFIG FILES")
  const structureChecks: CheckResult[] = [
    pathExists("lib/config/ai-config.ts"),
    pathExists("lib/services/ai-service.ts"),
    pathExists("app/api/ai"),
    pathExists(".env.local"),
  ]
  structureChecks.forEach(printCheckResult)
  sections.push({ section: "Structure & Config Files", checks: structureChecks })

  logHeader("ENVIRONMENT VALIDATION (.env.local)")
  const envLocal = loadEnvFile(".env.local")
  const envProfile = detectAIEnvProfile(envLocal)
  const envChecks: CheckResult[] = [
    checkExplicitEnvFlags(
      envLocal,
      [
        "NEXT_PUBLIC_ENABLE_AI_FEATURES",
        "NEXT_PUBLIC_ENABLE_CHATGPT",
        "NEXT_PUBLIC_ENABLE_GROK",
        "NEXT_PUBLIC_ENABLE_ANTHROPIC",
        "NEXT_PUBLIC_USE_MOCK_DATA",
        "NEXT_PUBLIC_DEBUG_MODE",
      ],
      ".env.local",
    ),
    checkAIEnvProfile(envLocal, ".env.local"),
    checkProviderEnvConsistency(envLocal, ".env.local"),
    checkBooleanEnv(
      envLocal,
      [{ key: "NEXT_PUBLIC_DEBUG_MODE", expected: "false" }],
      ".env.local debug flag set to false",
    ),
  ]
  envChecks.forEach(printCheckResult)
  sections.push({ section: "Environment Validation", checks: envChecks })

  logHeader("AI CONFIG WIRING")
  const wiringChecks: CheckResult[] = [
    checkSourceContains(
      "lib/config/ai-config.ts",
      [
        "getAIConfig",
        "isFeatureEnabled",
        "aiHealthCoach",
        "researchAssistant",
        "virtualAdvisor",
        "predictiveAnalytics",
      ],
      "AI config features present",
    ),
    checkSourceContains(
      "lib/services/ai-service.ts",
      [
        "getHealthRecommendation",
        "researchQuery",
        "getVirtualAdvisorResponse",
      ],
      "AI service methods present",
    ),
  ]
  wiringChecks.forEach(printCheckResult)
  sections.push({ section: "AI Config Wiring", checks: wiringChecks })

  logHeader("SECURITY & PRODUCTION FLAGS (STATIC CHECKS)")
  const securityChecks: CheckResult[] = [
    checkSourceContains(
      "lib/config/ai-config.ts",
      ["process.env.OPENAI_API_KEY"],
      "API key sourced from environment",
    ),
    checkSourceContains(
      "lib/config/ai-config.ts",
      ["process.env.NEXT_PUBLIC_DEBUG_MODE"],
      "Debug mode sourced from environment",
    ),
  ]
  securityChecks.forEach(printCheckResult)
  sections.push({ section: "Security & Production Flags", checks: securityChecks })

  logHeader("RATE LIMITING ON AI ROUTES")
  const rateLimitCheck = checkRateLimitingForAI()
  printCheckResult(rateLimitCheck)
  sections.push({ section: "Rate Limiting", checks: [rateLimitCheck] })

  logHeader("OBSERVABILITY & LOGGING")
  const observabilityCheck = checkObservabilityHooks()
  printCheckResult(observabilityCheck)
  sections.push({ section: "Observability & Logging", checks: [observabilityCheck] })

  logHeader("QUALITY GATES (TYPECHECK, LINT & TESTS)")
  const qualityChecks: CheckResult[] = [
    runPackageScript("typecheck"),
    runPackageScript("lint"),
    runPackageScript("test"),
  ]
  qualityChecks.forEach(printCheckResult)
  sections.push({ section: "Quality Gates", checks: qualityChecks })

  logHeader("SUMMARY: LEVEL 4 PRODUCTION READINESS (AI LAYER)")
  let passed = 0
  let failed = 0

  for (const section of sections) {
    for (const check of section.checks) {
      if (check.passed) passed++
      else failed++
    }
  }

  const profileAwareResult = getProfileAwareResult(envProfile.profile, failed)

  console.log(`Package manager: ${packageManager}`)
  console.log(`Profile: ${envProfile.profile}`)
  console.log(`Passed: ${passed}, Failed: ${failed}`)

  console.log(profileAwareResult.consoleSummary)

  generateMarkdownReport(sections, envProfile.profile)
  process.exit(failed === 0 ? 0 : 1)
}

main()