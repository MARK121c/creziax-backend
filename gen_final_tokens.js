const jwt = require('./node_modules/jsonwebtoken');
const secret = "Creziax@SuperSecret#2026!JWT_Key$Secure";

const admin = { id: "30469154-e761-4f9a-99f4-3505d0706417", role: "OWNER", email: "admin@creziax.com" };
const client = { id: "85887f61-5407-430d-817b-7eec1236077f", role: "CLIENT", email: "me618@gmail.com" };

const adminToken = jwt.sign(admin, secret);
const clientToken = jwt.sign(client, secret);

console.log('--- TOKENS ---');
console.log('ADMIN_TOKEN=' + adminToken);
console.log('CLIENT_TOKEN=' + clientToken);
console.log('--- END ---');
