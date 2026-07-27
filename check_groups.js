const prisma = require('./prismaClient');

async function checkGroups() {
  try {
    const groups = await prisma.teamGroup.findMany({
      include: { members: { select: { id: true, firstName: true, lastName: true, role: true } } }
    });
    console.log(JSON.stringify(groups, null, 2));
    
    const users = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'OWNER', 'TEAM'] } },
      select: { id: true, firstName: true, role: true }
    });
    console.log('\n--- Internal Users ---');
    console.log(users.length);
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkGroups();
