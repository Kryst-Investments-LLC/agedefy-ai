import { mkdir, readFile, writeFile } from 'node:fs/promises'

async function buildSchemaVariant(targetFileName) {
  const sourcePath = new URL('../prisma/schema.prisma', import.meta.url)
  const targetPath = new URL(`../node_modules/.cache/prisma/outbox/${targetFileName}`, import.meta.url)

  const source = await readFile(sourcePath, 'utf8')
  const schemaVariant = source
    .replace('provider = "sqlite"', 'provider = "postgresql"')
    .replace(
      'provider = "prisma-client-js"',
      'provider = "prisma-client-js"\n  output   = "../../../node_modules/.cache/prisma/outbox-client"'
    )

  if (schemaVariant === source) {
    throw new Error('Failed to build Prisma schema variant: sqlite datasource provider not found.')
  }

  await mkdir(new URL('../node_modules/.cache/prisma/outbox', import.meta.url), { recursive: true })
  await writeFile(targetPath, schemaVariant)
}

await buildSchemaVariant('schema.prisma')