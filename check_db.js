const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() { 
  const invs = await prisma.invoice.findMany({ 
    orderBy: { createdAt: 'desc' }, 
    take: 20, 
    select: { invoiceNumber: true, amount: true, currency: true, exchangeRate: true, createdAt: true } 
  }); 
  console.log(JSON.stringify(invs, null, 2)); 
} 
main().catch(console.error).finally(() => prisma.$disconnect());
