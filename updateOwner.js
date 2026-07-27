const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.user.updateMany({
    where: { email: 'admin@creziax.com' },
    data: { role: 'OWNER' }
  });
  console.log(`Updated ${result.count} user(s) to OWNER.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
