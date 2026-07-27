const { Client } = require('pg');

const url = "postgresql://postgres.kgrlfdomrclfivhhmnoy:BongurMark12345@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require";

const client = new Client({
  connectionString: url,
  ssl: {
    rejectUnauthorized: false
  }
});

client.connect()
  .then(() => {
    console.log("Connected successfully!");
    return client.query('SELECT NOW()');
  })
  .then((res) => {
    console.log("Query result:", res.rows);
    return client.end();
  })
  .catch((err) => {
    console.error("Connection error:", err.message);
    process.exit(1);
  });
