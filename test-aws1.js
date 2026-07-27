const { Client } = require('pg');
const url = "postgresql://postgres.kgrlfdomrclfivhhmnoy:BongurMark12345@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
const client = new Client({ 
  connectionString: url,
  ssl: { rejectUnauthorized: false }
});

async function test() {
  try {
    await client.connect();
    console.log('AWS-1 CONNECTION SUCCESS!');
    const res = await client.query('SELECT NOW()');
    console.log('Result:', res.rows[0]);
    await client.end();
  } catch (err) {
    console.error('AWS-1 CONNECTION FAILED:', err.message);
  }
}

test();
