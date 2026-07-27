const prisma = require('./prismaClient');
const bcrypt = require('bcryptjs');

async function updateAdmin() {
  const email = 'admin@creziax.com';
  const newPassword = 'Admin@123';

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  // Check if user exists
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    // Update existing user
    await prisma.user.update({
      where: { email },
      data: {
        password: hashedPassword,
        email: email,
        role: existing.role === 'CLIENT' ? 'OWNER' : existing.role
      }
    });
    console.log(`✅ Admin password updated successfully!`);
  } else {
    // Create new owner
    const salt2 = await bcrypt.genSalt(10);
    const hash2 = await bcrypt.hash(newPassword, salt2);
    await prisma.user.create({
      data: {
        firstName: 'Admin',
        lastName: 'Creziax',
        email,
        password: hash2,
        role: 'OWNER',
      }
    });
    console.log(`✅ Admin user created!`);
  }

  console.log(`Email: ${email}`);
  console.log(`Password: ${newPassword}`);
  process.exit(0);
}

updateAdmin().catch((e) => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
