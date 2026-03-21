const { Client } = require('pg');
const url = "postgresql://postgres.kgrlfdomrclfivhhmnoy:BongurMark12345@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
const client = new Client({ 
  connectionString: url,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  try {
    await client.connect();
    console.log('Connected to database for manual migration...');

    // 1. Create Enum if not exists
    try {
      await client.query(`CREATE TYPE "HealthScore" AS ENUM ('GOOD', 'MONITOR', 'AT_RISK')`);
      console.log('Created HealthScore enum.');
    } catch (e) {
      console.log('HealthScore enum already exists or failed to create:', e.message);
    }

    // 2. Add columns
    const columns = [
      { name: 'contractStartDate', type: 'TIMESTAMP' },
      { name: 'contractEndDate', type: 'TIMESTAMP' },
      { name: 'healthScore', type: '"HealthScore"', default: "'GOOD'" },
      { name: 'internalNotes', type: 'TEXT', default: "''" }
    ];

    for (const col of columns) {
      try {
        await client.query(`ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type} ${col.default ? 'DEFAULT ' + col.default : ''}`);
        console.log(`Added column ${col.name}.`);
      } catch (e) {
        console.error(`Failed to add column ${col.name}:`, e.message);
      }
    }

    await client.end();
    console.log('Manual migration finished.');
  } catch (err) {
    console.error('Migration failed:', err.message);
  }
}

migrate();
