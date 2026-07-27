const { Client } = require('pg');

const url = "postgresql://postgres.kgrlfdomrclfivhhmnoy:BongurMark12345@aws-1-eu-central-1.pooler.supabase.com:5432/postgres";

const client = new Client({ 
  connectionString: url, 
  connectionTimeoutMillis: 5000,
  ssl: { rejectUnauthorized: false }
});

client.connect()
  .then(() => {
    console.log("[SUCCESS] Connected to session pooler!");
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
