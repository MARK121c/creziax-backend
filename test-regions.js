const { Client } = require('pg');

const regions = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1',
  'ap-southeast-1', 'ap-northeast-1', 'ap-northeast-2', 'ap-southeast-2',
  'ap-south-1', 'sa-east-1', 'ca-central-1'
];

async function testRegions() {
  for (const region of regions) {
    const url = `postgresql://postgres.kgrlfdomrclfivhhmnoy:BongurMark12345@aws-0-${region}.pooler.supabase.com:6543/postgres`;
const client = new Client({ 
      connectionString: url, 
      connectionTimeoutMillis: 5000,
      ssl: { rejectUnauthorized: false }
    });
    try {
      await client.connect();
      console.log(`[SUCCESS] Found region: ${region}`);
      await client.end();
      return region;
    } catch (err) {
      console.log(`[?] Region ${region} returned error: ${err.message}`);
    }
  }
  console.log('Done testing.');
}

testRegions();
