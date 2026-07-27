const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function resetPassword() {
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Admin@123', salt);
    
    await prisma.user.update({
      where: { email: 'admin@creziax.com' },
      data: { password: hashedPassword }
    });
    
    console.log('Successfully reset admin@creziax.com password to Admin@123 on the live database.');
  } catch (err) {
    console.error('Error resetting password:', err);
  } finally {
    await prisma.$disconnect();
  }
}

resetPassword();
