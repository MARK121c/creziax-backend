process.env.DATABASE_URL = 'postgresql://postgres.kgrlfdomrclfivhhmnoy:BongurMark12345@aws-1-eu-central-1.pooler.supabase.com:5432/postgres';
process.env.JWT_SECRET = 'creziax-super-secret-jwt-key-2026';

const prisma = require('../prismaClient');
const bcrypt = require('bcryptjs');

async function testLogin() {
  try {
    console.log('Testing prisma.user.findUnique for admin.mark@creziax.com...');
    const user = await prisma.user.findUnique({
      where: { email: 'admin.mark@creziax.com' },
      include: { clientInfo: true }
    });
    console.log('Found user:', user ? { id: user.id, email: user.email, role: user.role } : 'Not found');

    console.log('Testing prisma.user.findUnique for client drmonnny@gmail.com...');
    const clientUser = await prisma.user.findUnique({
      where: { email: 'drmonnny@gmail.com' },
      include: { clientInfo: true }
    });
    console.log('Found client user:', clientUser ? { id: clientUser.id, email: clientUser.email, role: clientUser.role, clientInfo: clientUser.clientInfo } : 'Not found');
    
    console.log('Prisma queries succeeded without any errors!');
  } catch (err) {
    console.error('Error during testLogin:', err);
  } finally {
    await prisma.$disconnect();
  }
}

testLogin();
