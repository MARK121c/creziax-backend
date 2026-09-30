if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const prisma = require('../prismaClient');

async function testLoginQuery() {
  try {
    console.log('Testing prisma connection and User + clientInfo query...');
    const user = await prisma.user.findFirst({
      include: { clientInfo: true }
    });
    console.log('Successfully found user:', user?.email, user?.role);
  } catch (err) {
    console.error('ERROR during user query:', err);
  } finally {
    await prisma.$disconnect();
  }
}

testLoginQuery();
