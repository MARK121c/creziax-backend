const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixEmails() {
  try {
    console.log('Fetching all users...');
    const users = await prisma.user.findMany({
      select: { id: true, email: true }
    });

    console.log(`Found ${users.length} users. Checking for uppercase emails...`);

    let updatedCount = 0;
    for (const user of users) {
      const lowerEmail = user.email.toLowerCase().trim();
      console.log(`Comparing "${user.email}" and "${lowerEmail}"`);
      if (lowerEmail !== user.email) {
        console.log(`Updating ${user.email} -> ${lowerEmail} ...`);
        try {
            await prisma.user.update({
                where: { id: user.id },
                data: { email: lowerEmail }
            });
            updatedCount++;
        } catch (updateErr) {
            console.error(`Failed to update ${user.email}: ${updateErr.message}`);
            // This might happen if there's a conflict (e.g. both omar@ and Omar@ exist)
        }
      }
    }

    console.log(`Done! Updated ${updatedCount} users.`);
  } catch (err) {
    console.error('Error fixing emails:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixEmails();
