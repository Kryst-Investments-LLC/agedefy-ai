import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"

const TEST_SERVER_PORT = Number(process.env.TEST_SERVER_PORT ?? 3101)
const TEST_SERVER_BASE_URL = `http://127.0.0.1:${TEST_SERVER_PORT}`
const TEST_SERVER_DIST_DIR = process.env.TEST_SERVER_DIST_DIR ?? ".next-test"

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function runCommand(options: {
  command: string
  args: string[]
  env: NodeJS.ProcessEnv
  description: string
}) {
  const logs: string[] = []
  const child = spawn(options.command, options.args, {
    cwd: process.cwd(),
    env: options.env,
    stdio: "pipe",
  })

  child.stdout.on("data", (chunk: Buffer) => {
    logs.push(String(chunk))
  })

  child.stderr.on("data", (chunk: Buffer) => {
    logs.push(String(chunk))
  })

  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.on("close", resolve)
    child.on("error", reject)
  })

  if (exitCode !== 0) {
    throw new Error(`${options.description} failed with exit code ${exitCode}\n${logs.join("")}`)
  }
}

async function isServerReady() {
  try {
    const response = await fetch(`${TEST_SERVER_BASE_URL}/api/health`, {
      redirect: "manual",
    })
    return response.ok || response.status === 404
  } catch {
    return false
  }
}

async function killServer(serverProcess: ChildProcessWithoutNullStreams | null) {
  if (!serverProcess?.pid) return

  if (process.platform === "win32") {
    await new Promise<void>((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(serverProcess.pid), "/t", "/f"], {
        stdio: "ignore",
      })
      killer.on("close", () => resolve())
      killer.on("error", () => resolve())
    })
    return
  }

  serverProcess.kill("SIGTERM")
  await new Promise<void>((resolve) => {
    serverProcess.once("close", () => resolve())
    setTimeout(() => resolve(), 3_000)
  })
}

export default async function globalSetup() {
  process.env.TEST_SERVER_BASE_URL = TEST_SERVER_BASE_URL
  const logs: string[] = []

  const env = Object.fromEntries(
    Object.entries({
      ...process.env,
      APP_ENV: "test",
      ENABLE_TEST_AUTH_ENDPOINT: "true",
      MFA_ENCRYPTION_KEY: process.env.MFA_ENCRYPTION_KEY ?? "biozephyra-test-mfa-encryption-key-material-2026",
      NEXTAUTH_URL: TEST_SERVER_BASE_URL,
      NEXT_DIST_DIR: TEST_SERVER_DIST_DIR,
      NODE_ENV: process.env.NODE_ENV ?? "test",
    }).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  ) as NodeJS.ProcessEnv

  const dbUrl = env.DATABASE_URL ?? ""
  const isPgUrl = dbUrl.startsWith("postgresql://") || dbUrl.startsWith("postgres://")

  if (isPgUrl) {
    const prismaCommand = process.platform === "win32" ? "cmd.exe" : "pnpm"
    const prismaArgs = process.platform === "win32"
      ? ["/d", "/s", "/c", "pnpm exec prisma db push --accept-data-loss --config prisma.config.ts"]
      : ["exec", "prisma", "db", "push", "--accept-data-loss", "--config", "prisma.config.ts"]

    await runCommand({
      command: prismaCommand,
      args: prismaArgs,
      env,
      description: "Prisma schema sync for tests",
    })
  } else {
    // Non-PostgreSQL URL (e.g. SQLite file:// during local dev) — skip db push.
    // Unit tests that need the DB mock it entirely; integration tests require a real PG URL.
    console.warn("[global-setup] Skipping prisma db push: DATABASE_URL is not a PostgreSQL URL")
  }

  const spawnCommand = process.platform === "win32" ? "cmd.exe" : "pnpm"
  const spawnArgs = process.platform === "win32"
    ? ["/d", "/s", "/c", `pnpm exec next dev -p ${TEST_SERVER_PORT}`]
    : ["exec", "next", "dev", "-p", String(TEST_SERVER_PORT)]

  const serverProcess: ChildProcessWithoutNullStreams = spawn(spawnCommand, spawnArgs, {
    cwd: process.cwd(),
    env,
    stdio: "pipe",
  })

  serverProcess.stdout.on("data", (chunk: Buffer) => {
    logs.push(String(chunk))
  })

  serverProcess.stderr.on("data", (chunk: Buffer) => {
    logs.push(String(chunk))
  })

  const timeoutAt = Date.now() + 60_000
  while (Date.now() < timeoutAt) {
    if (await isServerReady()) {
      return async () => {
        await killServer(serverProcess)
      }
    }

    if (serverProcess.exitCode !== null) {
      break
    }

    await wait(500)
  }

  await killServer(serverProcess)
  throw new Error(`Timed out waiting for test server at ${TEST_SERVER_BASE_URL}\n${logs.join("")}`)
}