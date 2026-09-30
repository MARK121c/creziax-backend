const { PrismaClient } = require('@prisma/client');

async function testWithUrl(url, label) {
  console.log(`\nTesting with ${label}: ${url}`);
  const prisma = new PrismaClient({
    datasources: {
      db: { url }
    }
  });

  try {
    const user = await prisma.user.findUnique({
      where: { email: 'admin.mark@creziax.com' },
      include: { clientInfo: true }
    });
    console.log(`[SUCCESS] ${label} connected! Found:`, user ? user.email : 'None');
  } catch (err) {
    console.error(`[FAIL] ${label}:`, err.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function run() {
  const url1 = "postgresql://postgres.kgrlfdomrclfivhhmnoy:BongurMark12345@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
  const url2 = "postgresql://postgres.kgrlfdomrclfivhhmnoy:BongurMark12345@aws-0-eu-central-1.pooler.supabase.com:5432/postgres";
  const url3 = "postgresql://postgres.kgrlfdomrclfivhhmnoy:BongurMark12345@db.kgrlfdomrclfivhhmnoy.supabase.co:5432/postgres";

  await testWithUrl(url1, 'Supabase Pooler 6543 (pgbouncer)');
  await testWithUrl(url2, 'Supabase Pooler 5432 (session)');
  await testWithUrl(url3, 'Supabase Direct 5432');
}

run();
