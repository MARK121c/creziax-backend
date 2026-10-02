require('dotenv').config();
const { Client } = require('pg');

async function test() {
  console.log('Testing connection to:', process.env.DATABASE_URL.split('@')[1]);
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✅ Successfully connected to database with rejectUnauthorized: false');
    const res = await client.query('SELECT NOW()');
    console.log('Time:', res.rows[0]);
    await client.end();
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
  }
}

test();
