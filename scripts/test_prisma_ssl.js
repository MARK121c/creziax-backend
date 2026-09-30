const { PrismaClient } = require('@prisma/client');

async function testWithUrl(url, label) {
  console.log(`\nTesting with ${label}...`);
  const prisma = new PrismaClient({
    datasources: {
      db: { url }
    }
  });

  try {
    const user = await prisma.user.findFirst({
      select: { id: true, email: true, role: true, isOnline: true }
    });
    console.log(`[SUCCESS] ${label} connected! Found user:`, user);
    return true;
  } catch (err) {
    console.error(`[FAIL] ${label}:`, err.message);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

async function run() {
  const base = "postgresql://postgres.kgrlfdomrclfivhhmnoy:BongurMark12345";
  
  const urls = [
    { label: 'Pooler 5432 with sslmode=no-verify', url: `${base}@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=no-verify` },
    { label: 'Pooler 5432 with sslmode=require', url: `${base}@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require` },
    { label: 'Pooler 6543 with pgbouncer and sslmode=require', url: `${base}@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true` },
    { label: 'Pooler 6543 with pgbouncer and sslmode=no-verify', url: `${base}@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=no-verify&pgbouncer=true` },
    { label: 'Pooler 6543 default', url: `${base}@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true` }
  ];

  for (const item of urls) {
    const ok = await testWithUrl(item.url, item.label);
    if (ok) {
      console.log(`\n>>> RECOMMENDED WORKING URL: ${item.url}`);
      break;
    }
  }
}

run();
