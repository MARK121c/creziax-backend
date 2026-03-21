const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.kgrlfdomrclfivhhmnoy:BongurMark12345@db.kgrlfdomrclfivhhmnoy.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function test() {
  try {
    await client.connect();
    console.log('DIRECT CONNECTION SUCCESS!');
    const res = await client.query('SELECT NOW()');
    console.log('Result:', res.rows[0]);
    await client.end();
  } catch (err) {
    console.error('DIRECT CONNECTION FAILED:', err.message);
  }
}

test();
