import { spawn } from "node:child_process"

export default async function postgresGlobalSetup() {
  const command = process.platform === "win32" ? "cmd.exe" : "pnpm"
  const args = process.platform === "win32"
    ? ["/d", "/s", "/c", "pnpm exec prisma db push --accept-data-loss --config prisma.config.ts"]
    : ["exec", "prisma", "db", "push", "--accept-data-loss", "--config", "prisma.config.ts"]

  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  })
  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.on("close", resolve)
    child.on("error", reject)
  })
  if (exitCode !== 0) throw new Error(`PostgreSQL test schema setup failed with exit code ${exitCode}`)
}
