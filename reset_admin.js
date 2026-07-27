const prisma = require('./prismaClient');
const bcrypt = require('bcryptjs');

async function main() {
  const email = 'admin.mark@creziax.com';
  const pass = 'A44d2m1i33nFaat123';
  const hashedPassword = await bcrypt.hash(pass, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      role: 'ADMIN',
    },
    create: {
      email,
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'Mark',
      role: 'ADMIN',
    }
  });

  console.log('Successfully updated/created user:', user.email, 'Role:', user.role);
}

main().catch(console.error).finally(() => prisma.$disconnect());
