// Temporary dev helper: creates a login-capable demo user for local recording.
// Safe to delete. Run: node _dev-demo-user.cjs  (with DATABASE_URL set to the dev DB)
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  const passwordHash = bcrypt.hashSync('demo1234', 10)
  const user = await prisma.user.upsert({
    where: { email: 'demo@biozephyra.dev' },
    update: { passwordHash, role: 'RESEARCHER', name: 'Demo Researcher' },
    create: { email: 'demo@biozephyra.dev', name: 'Demo Researcher', passwordHash, role: 'RESEARCHER' },
  })
  console.log('demo user ready:', user.email, '/ role:', user.role, '/ id:', user.id)
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
