const prisma = require('./prismaClient');
const { getMessages, getThreads } = require('./controllers/messageController');

async function test() {
  console.log("Finding user...");
  const user = await prisma.user.findUnique({ where: { email: 'SDVGDSV@GMAIL.COM' } });
  if (!user) return console.log('User not found');
  console.log("User:", user.id, user.role);

  // 1. Test getThreads
  console.log("\n--- Testing getThreads ---");
  const res1 = { json: (data) => console.log('Threads:', JSON.stringify(data).substring(0, 100)) };
  await getThreads({ user }, res1, (err) => console.error("getThreads Error:", err));

  // 2. Test getMessages
  console.log("\n--- Testing getMessages ---");
  const groups = await prisma.teamGroup.findMany({ 
    where: { members: { some: { id: user.id } } }
  });
  console.log('User Groups:', groups.length);
  
  const threadId = groups[0] ? groups[0].id : null;
  if (threadId) {
    const req2 = { query: { threadId }, user: user };
    const res2 = {
      json: (data) => console.log('Messages Response:', data.length, 'messages'),
      status: (code) => ({ json: (data) => console.log(`Status ${code}:`, data) })
    };
    await getMessages(req2, res2, (err) => console.error('getMessages Error:', err));
  } else {
    // Try without threadId or a fake one
    const req2 = { query: { threadId: user.id }, user: user };
    const res2 = {
      json: (data) => console.log('Messages Response:', data.length, 'messages'),
      status: (code) => ({ json: (data) => console.log(`Status ${code}:`, data) })
    };
    await getMessages(req2, res2, (err) => console.error('getMessages Error:', err));
  }
}
test().catch(console.error).finally(() => prisma.$disconnect());
