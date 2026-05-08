import {
  formatEnvironmentValidationError,
  formatRuntimeBaselineIssues,
  getRuntimeBaseline,
  parseEnvironment,
} from '@/lib/env'

const parsedEnv = parseEnvironment()
const runtimeBaseline = getRuntimeBaseline()

if (!parsedEnv.success) {
  console.error(`Environment validation: ${formatEnvironmentValidationError(parsedEnv.error)}`)
} else {
  console.log('Environment validation: ok')
}

console.log(`App environment: ${runtimeBaseline.appEnv}`)
console.log(`Production baseline required: ${runtimeBaseline.productionBaselineRequired ? 'yes' : 'no'}`)
console.log(`Database provider: ${runtimeBaseline.databaseProvider}`)
console.log(`Redis-backed rate limiting: ${runtimeBaseline.redisConfigured ? 'configured' : 'missing'}`)
console.log(`OTel export: ${runtimeBaseline.otelConfigured ? 'configured' : 'missing'}`)

if (runtimeBaseline.issues.length > 0) {
  console.error(`Runtime baseline issues: ${formatRuntimeBaselineIssues(runtimeBaseline.issues)}`)
}

if (!parsedEnv.success || runtimeBaseline.issues.length > 0) {
  process.exitCode = 1
}