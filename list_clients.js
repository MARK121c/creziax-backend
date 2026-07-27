const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const clients = await prisma.user.findMany({
      where: { role: 'CLIENT' },
      select: { email: true, firstName: true, lastName: true }
    });
    console.log(JSON.stringify(clients, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
