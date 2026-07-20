const errors: string[] = []

for (const name of ["DATABASE_URL", "POSTGRES_DATABASE_URL"] as const) {
  const value = process.env[name]?.trim()
  if (!value) {
    errors.push(`${name} is required`)
    continue
  }
  if (!value.startsWith("postgresql://") && !value.startsWith("postgres://")) {
    errors.push(`${name} must be a PostgreSQL URL`)
  }
}

for (const name of ["NEXTAUTH_SECRET", "MFA_ENCRYPTION_KEY"] as const) {
  if ((process.env[name]?.trim().length ?? 0) < 32) {
    errors.push(`${name} must contain at least 32 characters`)
  }
}

if (process.env.APP_ENV !== "test") errors.push("APP_ENV must be test")

if (errors.length) {
  console.error("Integration test prerequisites are not satisfied:")
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log("Integration test prerequisites verified.")
