const { Client } = require('pg');

const url = "postgresql://postgres.kgrlfdomrclfivhhmnoy:BongurMark12345@aws-1-eu-central-1.pooler.supabase.com:5432/postgres";

const client = new Client({ 
  connectionString: url, 
  connectionTimeoutMillis: 10000,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    await client.connect();
    console.log('[SUCCESS] Connected to Supabase DB for migration!');

    // 1. Add missing columns to Client table
    const alterQueries = [
      `ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "monthlyDueDate" INTEGER;`,
      `ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "monthlyAmount" DOUBLE PRECISION;`,
      `ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "channelLink" TEXT;`,
      `ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "productionStages" TEXT[] DEFAULT '{}';`
    ];

    for (const q of alterQueries) {
      console.log('Executing:', q);
      await client.query(q);
      console.log('  -> OK');
    }

    // 2. Create PublishSchedule table if not exists
    console.log('Creating PublishSchedule table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "PublishSchedule" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "title" TEXT NOT NULL,
        "publishTime" TIMESTAMP(3) NOT NULL,
        "frequency" TEXT,
        "notes" TEXT,
        "projectId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PublishSchedule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);
    console.log('  -> PublishSchedule table OK');

    // 3. Verify columns exist on Client table
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Client';
    `);
    console.log('Client columns in DB:');
    console.table(res.rows);

    await client.end();
    console.log('[MIGRATION COMPLETED SUCCESSFULLY]');
  } catch (err) {
    console.error('[MIGRATION ERROR]', err);
    process.exit(1);
  }
}

runMigration();
