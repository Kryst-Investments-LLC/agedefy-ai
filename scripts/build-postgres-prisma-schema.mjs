import { mkdir, readFile, writeFile } from 'node:fs/promises'

const sourcePath = new URL('../prisma/schema.prisma', import.meta.url)
const targetPath = new URL('../node_modules/.cache/prisma/postgres/schema.prisma', import.meta.url)

const source = await readFile(sourcePath, 'utf8')
const postgresSchema = source
  .replace('provider = "sqlite"', 'provider = "postgresql"')
  .replace(
    'provider = "prisma-client-js"',
    'provider = "prisma-client-js"\n  output   = "../../../node_modules/.cache/prisma/postgres-client"'
  )

if (postgresSchema === source) {
  throw new Error('Failed to build PostgreSQL Prisma schema: sqlite datasource provider not found.')
}

await mkdir(new URL('../node_modules/.cache/prisma/postgres', import.meta.url), { recursive: true })
await writeFile(targetPath, postgresSchema)