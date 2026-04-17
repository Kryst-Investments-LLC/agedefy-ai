import { mkdir, readFile, writeFile } from 'node:fs/promises'

const sourcePath = new URL('../prisma/schema.prisma', import.meta.url)
const targetDirectory = new URL('../node_modules/.cache/prisma/postgres-runtime/', import.meta.url)
const targetPath = new URL('../node_modules/.cache/prisma/postgres-runtime/schema.prisma', import.meta.url)

const source = await readFile(sourcePath, 'utf8')
const postgresSchema = source.replace('provider = "sqlite"', 'provider = "postgresql"')

if (postgresSchema === source) {
  throw new Error('Failed to build PostgreSQL runtime Prisma schema: sqlite datasource provider not found.')
}

await mkdir(targetDirectory, { recursive: true })
await writeFile(targetPath, postgresSchema)