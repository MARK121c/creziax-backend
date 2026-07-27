const prisma = require('./prismaClient');
const bcrypt = require('bcryptjs');

async function reset() {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('Nasser123!', salt);
  await prisma.user.update({
    where: { email: 'nassersameh44@gmail.com' },
    data: { password: hashedPassword }
  });
  console.log("Updated Nasser");
}

reset().finally(() => prisma.$disconnect());
