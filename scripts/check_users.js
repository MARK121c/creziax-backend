const { Client } = require('pg');
const url = 'postgresql://postgres.kgrlfdomrclfivhhmnoy:BongurMark12345@aws-1-eu-central-1.pooler.supabase.com:5432/postgres';
const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function check() {
  try {
    await client.connect();
    console.log('Connected to DB!');
    
    // Check users
    const res = await client.query('SELECT id, email, role, "firstName", "lastName" FROM "User" LIMIT 20');
    console.log('Users in DB:');
    console.table(res.rows);

    // Check columns of User
    const cols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'User'");
    console.log('User columns:', cols.rows.map(r => r.column_name));

    // Check columns of Client
    const clientCols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Client'");
    console.log('Client columns:', clientCols.rows.map(r => r.column_name));

    await client.end();
  } catch(e) {
    console.error('Error:', e);
  }
}
check();
