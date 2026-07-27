const prisma = require('../prismaClient');

async function restoreGeneralGroup() {
  console.log('--- 🚀 Creziax General Group Restoration Protocol ---');
  try {
    // 1. Find or Create the General Group
    let group = await prisma.teamGroup.findFirst({
      where: { name: { contains: 'General' } }
    });

    if (!group) {
        console.log('Creating new General Team Group...');
        group = await prisma.teamGroup.create({
            data: { name: 'جروب فريق العمل (General)' }
        });
    }

    console.log(`Target Group ID: ${group.id}`);

    // 2. Find all internal users (ADMIN, OWNER, TEAM)
    const internalUsers = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'OWNER', 'TEAM'] } }
    });

    console.log(`Found ${internalUsers.length} internal users.`);

    // 3. Connect users to group and add permission tag
    const permissionTag = `chat:${group.id}`;

    for (const user of internalUsers) {
      console.log(`Syncing user: ${user.firstName} (${user.role})`);
      
      const updatedPermissions = Array.from(new Set([...user.permissions, permissionTag]));
      
      await prisma.user.update({
        where: { id: user.id },
        data: {
          permissions: updatedPermissions,
          teamGroups: {
            connect: { id: group.id }
          }
        }
      });
    }

    console.log('\n✅ Restore Complete! All team members synced.');
  } catch (err) {
    console.error('❌ Error during restoration:', err);
  } finally {
    await prisma.$disconnect();
  }
}

restoreGeneralGroup();
