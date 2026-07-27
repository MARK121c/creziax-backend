const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Attempting to connect with Prisma...');
    await prisma.$connect();
    console.log('SUCCESS: Prisma connected!');
    const users = await prisma.user.count();
    console.log('User count:', users);
    
    console.log('Testing queryRaw SELECT 1...');
    const result = await prisma.$queryRaw`SELECT 1`;
    console.log('queryRaw SUCCESS:', result);

  } catch (err) {
    console.error('FAILED: Prisma connection error:');
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
