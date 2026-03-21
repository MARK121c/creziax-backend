const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function check() {
  const sum = await p.expense.aggregate({ _sum: { amount: true } });
  console.log('Total Expenses Amount:', sum._sum.amount);
  
  const allExp = await p.expense.findMany();
  console.log('All expenses:', allExp);
  
  await p.$disconnect();
}

check();
