import { getRuntimeBaseline } from "@/lib/env"

const baseline = getRuntimeBaseline(process.env)
const errors: string[] = []

if (process.env.APP_ENV !== "staging" && process.env.APP_ENV !== "production") {
  errors.push("APP_ENV must be staging or production")
}
if (process.env.NODE_ENV !== "production") errors.push("NODE_ENV must be production")
if (process.env.RUNTIME_REQUIREMENTS_ENFORCED !== "true") {
  errors.push("RUNTIME_REQUIREMENTS_ENFORCED must be true")
}
if (process.env.ENABLE_TEST_AUTH_ENDPOINT !== "false") {
  errors.push("ENABLE_TEST_AUTH_ENDPOINT must be explicitly false")
}
if (baseline.issues.some((issue) => issue.code === "auth.test_endpoint_forbidden")) {
  errors.push("runtime baseline rejected the test-auth endpoint configuration")
}

if (errors.length) {
  console.error("Deployment environment assertion failed:")
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log("Deployment environment safety assertions passed.")
