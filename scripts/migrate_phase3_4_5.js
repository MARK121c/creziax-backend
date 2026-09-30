const { Client } = require('pg');
const { execSync } = require('child_process');

const connectionString = "postgresql://postgres.kgrlfdomrclfivhhmnoy:BongurMark12345@aws-1-eu-central-1.pooler.supabase.com:5432/postgres";

async function runMigration() {
  console.log('[1/2] Connecting to PostgreSQL database...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('[+] Connected successfully.');

    // 1. Add columns to "User" table
    console.log('[+] Updating "User" table with presence columns...');
    await client.query(`
      ALTER TABLE "User" 
      ADD COLUMN IF NOT EXISTS "isOnline" BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP(3);
    `);

    // 2. Create "Lead" table
    console.log('[+] Creating "Lead" table if not exists...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "Lead" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "niche" TEXT,
        "nationality" TEXT,
        "hasOtherBusiness" TEXT,
        "followersCount" TEXT,
        "videosCount" TEXT,
        "startDate" TIMESTAMP(3),
        "avgViews" TEXT,
        "proposedPrice" DOUBLE PRECISION,
        "meetingDate" TIMESTAMP(3),
        "meetingTime" TEXT,
        "meetingLink" TEXT,
        "phone" TEXT,
        "email" TEXT,
        "channelUrl" TEXT,
        "notes" TEXT,
        "status" TEXT NOT NULL DEFAULT 'NEW',
        "createdById" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
        "assignedToId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Create "SystemSetting" table
    console.log('[+] Creating "SystemSetting" table if not exists...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "SystemSetting" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "key" TEXT NOT NULL UNIQUE,
        "value" JSONB NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('[+] Database migration executed successfully!');
    await client.end();

    // 4. Generate Prisma Client
    console.log('[2/2] Generating Prisma Client locally...');
    execSync('npx prisma generate', { stdio: 'inherit' });
    console.log('[SUCCESS] All migrations and prisma client generation completed!');
  } catch (err) {
    console.error('[ERROR] Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
