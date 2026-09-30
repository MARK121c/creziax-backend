const { Client } = require('pg');

const url = "postgresql://postgres.kgrlfdomrclfivhhmnoy:BongurMark12345@aws-1-eu-central-1.pooler.supabase.com:5432/postgres";

const client = new Client({ 
  connectionString: url, 
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    await client.connect();
    const res = await client.query('SELECT "id", "userId", "monthlyDueDate", "monthlyAmount", "channelLink", "productionStages" FROM "Client" LIMIT 5;');
    console.log('[SUCCESS] Successfully queried Client columns:');
    console.log(res.rows);
    await client.end();
  } catch (err) {
    console.error('[ERROR]', err.message);
  }
}

check();
