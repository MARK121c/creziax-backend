const { Client } = require('pg');
const url = "postgresql://postgres.kgrlfdomrclfivhhmnoy:BongurMark12345@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
const client = new Client({ 
  connectionString: url,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  try {
    await client.connect();
    console.log('Connected to database for migration...');

    // 1. Add columns to Client table
    const columns = [
      { name: 'monthlyDueDate', type: 'INTEGER' },
      { name: 'monthlyAmount', type: 'DOUBLE PRECISION' },
      { name: 'channelLink', type: 'TEXT' },
      { name: 'productionStages', type: "TEXT[] DEFAULT '{}'" }
    ];

    for (const col of columns) {
      try {
        await client.query(`ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type}`);
        console.log(`Added column ${col.name} to Client.`);
      } catch (e) {
        console.error(`Failed to add column ${col.name}:`, e.message);
      }
    }

    // 2. Create PublishSchedule table
    try {
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
      console.log('Created PublishSchedule table.');
    } catch (e) {
      console.error('Failed to create PublishSchedule table:', e.message);
    }

    await client.end();
    console.log('Migration finished successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
  }
}

migrate();
