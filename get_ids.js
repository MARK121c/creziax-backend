const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres.kgrlfdomrclfivhhmnoy:BongurMark12345@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=no-verify"
    }
  }
});

async function run() {
  try {
    const users = await prisma.user.findMany({
      where: { email: { in: ['me618@gmail.com', 'admin@creziax.com'] } },
      select: { id: true, email: true, role: true }
    });
    console.log('USERS_DATA:', JSON.stringify(users));
  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}
run();
