import { execFileSync } from 'node:child_process'

function runPnpm(args) {
  if (process.platform === 'win32') {
    execFileSync(process.env.COMSPEC ?? 'cmd.exe', ['/d', '/s', '/c', `pnpm ${args.join(' ')}`], { stdio: 'inherit' })
    return
  }

  execFileSync('pnpm', args, { stdio: 'inherit' })
}

function getDatabaseUrl() {
  return process.env.POSTGRES_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim() || ''
}

function resolveRuntimeTarget() {
  const explicitTarget = process.env.PRISMA_RUNTIME?.trim().toLowerCase()
  if (explicitTarget === 'postgres' || explicitTarget === 'sqlite') {
    return explicitTarget
  }

  const databaseUrl = getDatabaseUrl().toLowerCase()
  if (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')) {
    return 'postgres'
  }

  return 'sqlite'
}

const runtimeTarget = resolveRuntimeTarget()

if (runtimeTarget === 'postgres') {
  execFileSync(process.execPath, ['scripts/build-postgres-runtime-prisma-schema.mjs'], { stdio: 'inherit' })
  runPnpm(['exec', 'prisma', 'generate', '--schema', 'node_modules/.cache/prisma/postgres-runtime/schema.prisma'])
} else {
  runPnpm(['exec', 'prisma', 'generate', '--config', 'prisma.config.ts'])
}