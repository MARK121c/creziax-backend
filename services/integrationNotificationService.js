const axios = require('axios');
const prisma = require('../prismaClient');

const SETTING_KEY = 'NOTIFICATION_CONFIG';

/**
 * Get notification settings from DB
 */
const getNotificationConfig = async () => {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: SETTING_KEY }
    });
    if (setting && setting.value) {
      return setting.value;
    }
  } catch (err) {
    console.error('[NotificationConfig] Error fetching settings:', err.message);
  }

  // Default structure
  return {
    channel: 'TELEGRAM', // 'TELEGRAM' | 'WHATSAPP' | 'BOTH' | 'NONE'
    telegram: {
      enabled: false,
      botToken: '',
      chatId: ''
    },
    whatsapp: {
      enabled: false,
      apiUrl: '', // e.g., Green API / UltraMsg / Twilio / Custom Webhook
      apiKey: '',
      phoneNumber: '' // target phone or group ID
    }
  };
};

/**
 * Save notification settings to DB
 */
const saveNotificationConfig = async (config) => {
  const setting = await prisma.systemSetting.upsert({
    where: { key: SETTING_KEY },
    update: { value: config },
    create: { key: SETTING_KEY, value: config }
  });
  return setting.value;
};

/**
 * Format lead details into a clean, structured Arabic message
 */
const formatLeadMessage = (lead, creatorUser) => {
  const formattedMeeting = lead.meetingDate
    ? new Date(lead.meetingDate).toLocaleDateString('ar-EG', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }) + (lead.meetingTime ? ` الساعة ${lead.meetingTime}` : '')
    : 'لم يحدد بعد';

  const formattedStart = lead.startDate
    ? new Date(lead.startDate).toLocaleDateString('ar-EG')
    : 'لم يحدد بعد';

  const priceText = lead.proposedPrice != null ? `$${lead.proposedPrice}` : 'غير محدد';
  const creatorName = creatorUser ? `${creatorUser.firstName} ${creatorUser.lastName}` : 'موظف المبيعات';

  return `🎯 *تم تسجيل عميل محتمل جديد (New Lead)*
━━━━━━━━━━━━━━━━━━━━
👤 *الاسم:* ${lead.name || 'بدون اسم'}
💼 *النيش / المجال:* ${lead.niche || 'غير محدد'}
🌍 *جنسية العميل:* ${lead.nationality || 'غير محدد'}
🏢 *هل لديه بزنس آخر:* ${lead.hasOtherBusiness || 'لا'}
👥 *عدد المتابعين:* ${lead.followersCount || '0'}
🎬 *عدد الفيديوهات:* ${lead.videosCount || '0'}
👁️ *متوسط المشاهدات:* ${lead.avgViews || '0'}
💵 *السعر / المبلغ المقترح:* ${priceText}
🚀 *تاريخ البداية المقترح:* ${formattedStart}

📅 *موعد الاجتماع:* ${formattedMeeting}
${lead.meetingLink ? `🔗 *رابط الاجتماع:* ${lead.meetingLink}\n` : ''}
📞 *الهاتف / واتساب:* ${lead.phone || 'غير مسجل'}
✉️ *البريد:* ${lead.email || 'غير مسجل'}
${lead.channelUrl ? `📺 *رابط القناة:* ${lead.channelUrl}\n` : ''}
📝 *ملاحظات:* ${lead.notes || 'لا يوجد'}
━━━━━━━━━━━━━━━━━━━━
✍️ *المسؤول / المدخل:* ${creatorName}
⏰ *الوقت:* ${new Date().toLocaleString('ar-EG', { hour12: true })}`;
};

/**
 * Send notification to Telegram
 */
const sendTelegramNotification = async (botToken, chatId, text) => {
  if (!botToken || !chatId) {
    throw new Error('Telegram Bot Token and Chat ID are required.');
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const response = await axios.post(url, {
    chat_id: chatId,
    text: text,
    parse_mode: 'Markdown'
  }, { timeout: 10000 });

  return response.data;
};

/**
 * Send notification to WhatsApp via Webhook / API
 */
const sendWhatsAppNotification = async (whatsappConfig, text) => {
  const { apiUrl, apiKey, phoneNumber } = whatsappConfig;
  if (!apiUrl && !phoneNumber) {
    throw new Error('WhatsApp webhook URL or target phone number is required.');
  }

  // Generic flexible webhook POST payload
  if (apiUrl) {
    const payload = {
      phone: phoneNumber,
      to: phoneNumber,
      message: text,
      body: text,
      text: text
    };

    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
      headers['X-API-KEY'] = apiKey;
    }

    const response = await axios.post(apiUrl, payload, { headers, timeout: 10000 });
    return response.data;
  }
};

/**
 * Dispatch lead notification based on configured channels
 */
const dispatchLeadNotification = async (lead, creatorUser) => {
  try {
    const config = await getNotificationConfig();
    const text = formatLeadMessage(lead, creatorUser);
    const results = { telegram: null, whatsapp: null };

    // Telegram
    if (
      (config.channel === 'TELEGRAM' || config.channel === 'BOTH') &&
      config.telegram?.enabled &&
      config.telegram?.botToken &&
      config.telegram?.chatId
    ) {
      try {
        results.telegram = await sendTelegramNotification(
          config.telegram.botToken,
          config.telegram.chatId,
          text
        );
        console.log('[NotificationService] Telegram message sent successfully for Lead:', lead.name);
      } catch (tgErr) {
        console.error('[NotificationService] Telegram send failed:', tgErr.response?.data || tgErr.message);
      }
    }

    // WhatsApp
    if (
      (config.channel === 'WHATSAPP' || config.channel === 'BOTH') &&
      config.whatsapp?.enabled &&
      (config.whatsapp?.apiUrl || config.whatsapp?.phoneNumber)
    ) {
      try {
        results.whatsapp = await sendWhatsAppNotification(config.whatsapp, text);
        console.log('[NotificationService] WhatsApp notification sent for Lead:', lead.name);
      } catch (waErr) {
        console.error('[NotificationService] WhatsApp send failed:', waErr.response?.data || waErr.message);
      }
    }

    return results;
  } catch (err) {
    console.error('[NotificationService] Failed to dispatch lead notification:', err);
  }
};

/**
 * Send test notification
 */
const sendTestNotification = async (type, payload) => {
  const testMessage = `🔔 *رسالة تجريبية من نظام Creziax*
━━━━━━━━━━━━━━━━━━━━
✅ الربط التلقائي يعمل بنجاح!
⏰ الوقت: ${new Date().toLocaleString('ar-EG')}`;

  if (type === 'TELEGRAM') {
    return await sendTelegramNotification(payload.botToken, payload.chatId, testMessage);
  } else if (type === 'WHATSAPP') {
    return await sendWhatsAppNotification(payload, testMessage);
  }
  throw new Error('Unsupported notification type for test.');
};

module.exports = {
  getNotificationConfig,
  saveNotificationConfig,
  dispatchLeadNotification,
  sendTestNotification,
  formatLeadMessage
};
