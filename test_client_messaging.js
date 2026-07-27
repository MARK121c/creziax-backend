const prisma = require('./prismaClient');
const { getThreads, sendMessage, getMessages } = require('./controllers/messageController');

async function test() {
  console.log("Finding client user...");
  // Find a client user
  const clientUser = await prisma.user.findFirst({ where: { role: 'CLIENT' } });
  if (!clientUser) return console.log('Client User not found');
  console.log("Client User:", clientUser.id, clientUser.email);

  // 1. Test getThreads for Client
  console.log("\n--- Testing getThreads for Client ---");
  const req1 = { user: clientUser };
  const res1 = { json: (data) => console.log('Threads OK!') };
  await getThreads(req1, res1, (err) => console.error("getThreads Error:", err));

  // 2. Find Admin to send to (Support)
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) return console.log('Admin not found');

  // 3. Test sendMessage from Client to Admin
  console.log("\n--- Testing sendMessage from Client ---");
  const req3 = {
    user: clientUser,
    body: {
      content: 'Hello Support, I need help!',
      receiverId: admin.id,
      threadId: null
    },
    app: { get: () => null } // mock io
  };
  const res3 = {
    status: (code) => ({ json: (data) => console.log(`Status ${code}:`, data) }),
    json: (data) => console.log('Sent Message Successfully!')
  };
  await sendMessage(req3, res3, (err) => console.error('sendMessage Error:', err));
}
test().catch(console.error).finally(() => prisma.$disconnect());
