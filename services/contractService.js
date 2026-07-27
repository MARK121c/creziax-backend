const prisma = require('../prismaClient');
const { sendEmail } = require('./emailService');

/**
 * Contract Service
 * Handles checking for expiring contracts and sending automated notifications
 */

const checkContractRenewals = async () => {
  console.log(`[${new Date().toISOString()}] Starting Contract Renewal Check...`);

  // Calculate the target date (exactly 7 days from now)
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 7);
  
  // Create start and end of that day to catch all renewals on that date
  const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
  const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

  try {
    const clientsWithExpiringContracts = await prisma.client.findMany({
      where: {
        contractEndDate: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      include: {
        user: true
      }
    });

    if (clientsWithExpiringContracts.length === 0) {
      console.log('No contracts expiring in 7 days.');
      return;
    }

    console.log(`Found ${clientsWithExpiringContracts.length} contracts expiring in 7 days.`);

    const owner = await prisma.user.findFirst({ where: { role: 'OWNER' } });

    for (const client of clientsWithExpiringContracts) {
      const clientName = `${client.user.firstName} ${client.user.lastName}`;
      const expiryDateStr = client.contractEndDate.toLocaleDateString('ar-EG');

      // 1. Send Email to Client
      const clientSubject = `بخصوص تجديد تعاقدك مع Creziax 🚀`;
      const clientMessage = `
        <div dir="rtl" style="font-family: sans-serif; line-height: 1.6;">
          <h2 style="color: #4f46e5;">أهلاً ${client.user.firstName}،</h2>
          <p>نأمل أن تكون بخير وتطور مستمر.</p>
          <p>نود تذكيرك بأن عقدك الحالي مع وكالة <strong>Creziax</strong> يقترب من نهايته خلال 7 أيام (<strong>${expiryDateStr}</strong>).</p>
          <p>لقد سعدنا جداً بالعمل على مشاريعكم خلال الفترة الماضية، ونحن جاهزون للاستمرار في تحقيق المزيد من النجاحات معاً.</p>
          <p>يرجى إفادتنا برغبتكم في التجديد لنبدأ في تجهيز خطة الربع القادم.</p>
          <br/>
          <p>تحياتنا،<br/><strong>فريق كريزياكس.</strong></p>
        </div>
      `;

      await sendEmail(client.user.email, clientSubject, '', clientMessage);
      console.log(`Renewal email sent to client: ${client.user.email}`);

      // 2. Send Email to Owner
      if (owner) {
        const ownerSubject = `تنبيه: اقتراب انتهاء عقد العميل ${clientName}`;
        const ownerMessage = `
          <div dir="rtl" style="font-family: sans-serif; line-height: 1.6;">
            <h2 style="color: #f59e0b;">تنبيه تجديد عقد</h2>
            <p>مرحباً ${owner.firstName}،</p>
            <p>نحيطكم علماً بأن عقد العميل <strong>${clientName}</strong> (${client.company || 'بدون شركة'}) سينتهي خلال 7 أيام بتاريخ <strong>${expiryDateStr}</strong>.</p>
            <p>تم إرسال بريد تلقائي للعميل لتذكيره بالتجديد.</p>
          </div>
        `;
        await sendEmail(owner.email, ownerSubject, '', ownerMessage);
        console.log(`Renewal alert sent to owner: ${owner.email}`);
      }
    }

    console.log('Contract Renewal Check completed.');
  } catch (error) {
    console.error('Error during contract renewal check:', error);
  }
};

module.exports = { checkContractRenewals };
