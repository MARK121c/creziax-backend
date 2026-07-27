const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, firstName: true, role: true, password: true }
  });
  console.log("Current Users in DB:");
  console.table(users.map(u => ({
    email: u.email,
    name: u.firstName,
    role: u.role,
    password_hash: u.password.substring(0, 10) + '...'
  })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
