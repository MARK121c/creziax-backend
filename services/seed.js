const prisma = require('../prismaClient');
const bcrypt = require('bcryptjs');

// Seed script to create initial admin user
async function seed() {
  const email = 'admin@creziax.com';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log('Admin user already exists.');
    process.exit(0);
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('Admin@123', salt);

  await prisma.user.create({
    data: {
      firstName: 'Admin',
      lastName: 'Creziax',
      email,
      password: hashedPassword,
      role: 'ADMIN',
    },
  });

  console.log('Admin user created successfully!');
  console.log('Email: admin@creziax.com');
  console.log('Password: Admin@123');
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
