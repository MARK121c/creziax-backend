const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUser() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'admin@creziax.com' }
    });
    if (user) {
      console.log('User found:', { id: user.id, email: user.email, role: user.role });
    } else {
      console.log('User NOT found: admin@creziax.com');
      const allUsers = await prisma.user.findMany({ take: 5 });
      console.log('Preview of other users:', allUsers.map(u => u.email));
    }
  } catch (err) {
    console.error('Error checking user:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();
