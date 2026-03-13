const { Client } = require('pg');

const url = "postgresql://postgres.kgrlfdomrclfivhhmnoy:BongurMark12345@kgrlfdomrclfivhhmnoy.pooler.supabase.com:6543/postgres";
const client = new Client({ 
  connectionString: url, 
  connectionTimeoutMillis: 5000,
  ssl: { rejectUnauthorized: false }
});

client.connect()
  .then(() => {
    console.log("[SUCCESS] Connected to global pooler!");
    return client.query('SELECT NOW()');
  })
  .then((res) => {
    console.log("Query result:", res.rows);
    return client.end();
  })
  .catch((err) => {
    console.error("[ERROR]", err.message);
    process.exit(1);
  });
