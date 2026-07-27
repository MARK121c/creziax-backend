const prisma = require('./prismaClient');
const bcrypt = require('bcryptjs');

const usersToUpdate = [
  { email: 'heshaaamprince@gmail.com', password: 'H3ai4s6h5ahm6' },
  { email: 'omar_aljasser1@hotmail.com', password: 'O3a3r6A4l1Ja0e77r' },
  { email: 'admin.mark@creziax.com', password: 'A44d2m1i33nFaat123' }
];

async function resetPasswords() {
  console.log('--- Starting Targeted Password Reset ---');
  
  for (const userData of usersToUpdate) {
    try {
      const email = userData.email.toLowerCase().trim();
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);
      
      const updatedUser = await prisma.user.update({
        where: { email },
        data: { password: hashedPassword }
      });
      
      console.log(`[SUCCESS] Password updated for: ${updatedUser.email}`);
    } catch (error) {
      console.error(`[FAILED] Could not update ${userData.email}:`, error.message);
    }
  }
  
  await prisma.$disconnect();
  console.log('--- Operation Completed ---');
}

resetPasswords();
