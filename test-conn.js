const { Client } = require('pg');

const variations = [
  'postgres://postgres.kgrlfdomrclfivhhmnoy:BongurMark12345@aws-0-eu-central-1.pooler.supabase.com:6543/postgres',
  'postgres://postgres.kgrlfdomrclfivhhmnoy:BongurMark12345@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
  'postgres://postgres.kgrlfdomrclfivhhmnoy:BongurMark12345@aws-0-us-west-1.pooler.supabase.com:6543/postgres',
  'postgres://postgres.kgrlfdomrclfivhhmnoy:BongurMark12345@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres'
];

async function testAll() {
  for (const conn of variations) {
    const client = new Client({ connectionString: conn });
    console.log(`Testing: ${conn.replace(/:[^:]*@/, ':****@')}`);
    try {
      await client.connect();
      console.log('  SUCCESS!');
      await client.end();
      return;
    } catch (err) {
      console.error(`  FAILED: ${err.message}`);
    }
  }
}

testAll();
