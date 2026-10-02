const jwt = require('jsonwebtoken');
const https = require('https');

const userId = '37ce9338-8907-40ae-8f25-9adbc4d4fe1f';
const secret = "Creziax@SuperSecret#2026!JWT_Key$Secure";
// Sign a token for the test Team Member
const token = jwt.sign({ id: userId, role: 'TEAM' }, secret, { expiresIn: '1d' });

console.log('Generated JWT:', token);

const options = {
  hostname: 'api.creziax.cloud',
  path: '/api/stats/team-dashboard',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    try {
      console.log('RESPONSE:', JSON.stringify(JSON.parse(body), null, 2));
    } catch(e) {
      console.log('RAW RESPONSE:', body);
    }
  });
});

req.on('error', (e) => {
  console.error('REQUEST ERROR:', e);
});
req.end();
