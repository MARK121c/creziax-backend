const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() { 
  const ex = await prisma.expense.findMany({ 
    orderBy: { createdAt: 'desc' }, 
    take: 10, 
    select: { amount: true, category: true, createdAt: true } 
  }); 
  console.log(JSON.stringify(ex, null, 2)); 
} 
main().catch(console.error).finally(() => prisma.$disconnect());
