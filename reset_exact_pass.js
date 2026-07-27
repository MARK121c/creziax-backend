require('dotenv').config();
const prisma = require('./prismaClient');
const bcrypt = require('bcryptjs');

const usersToUpdate = [
  { email: 'admin.mark@creziax.com', password: 'A44d2m1i33nFaat123' },
  { email: 'heshaaamprince@gmail.com', password: 'H3ai4s6h5ahm6' },
  { email: 'Omar_aljasser1@hotmail.com', password: 'O3a3r6A4l1Ja0e77r' },
  { email: 'nassersameh44@gmail.com', password: 'N9a22s4rSa2e4h9' }
];

async function resetPasswords() {
  for (const userData of usersToUpdate) {
    try {
      // Must use lowercase for email lookup because the login controller does email.toLowerCase()
      const email = userData.email.toLowerCase().trim();
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);
      
      const updatedUser = await prisma.user.upsert({
        where: { email },
        update: { password: hashedPassword, role: 'ADMIN' },
        create: {
          email,
          password: hashedPassword,
          firstName: 'Admin',
          lastName: 'Mark',
          role: 'ADMIN'
        }
      });
      console.log(`[SUCCESS] Password updated for: ${updatedUser.email}`);
    } catch (error) {
      console.error(`[FAILED] Could not update ${userData.email}:`, error.message);
    }
  }
}

resetPasswords().finally(() => prisma.$disconnect());
