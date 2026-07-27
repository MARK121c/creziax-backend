const { Client } = require('pg');
require('dotenv').config();

async function check() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    console.log('Connected to:', process.env.DATABASE_URL.replace(/:[^:]*@/, ':****@'));
    
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log('Tables in public schema:');
    res.rows.forEach(row => console.log(' -', row.table_name));
    
    const hasContract = res.rows.some(r => r.table_name.toLowerCase() === 'contract');
    console.log('\nContract table exists:', hasContract);
    
    if (hasContract) {
      const cols = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'Contract';
      `);
      console.log('Columns in Contract table:');
      cols.rows.forEach(c => console.log(`   [${c.column_name}] (${c.data_type})`));
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

check();
