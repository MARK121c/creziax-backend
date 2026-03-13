FROM node:18-slim

# تثبيت OpenSSL لأنه مطلوب لـ Prisma
RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

# نسخ ملفات التعريف أولاً
COPY package*.json ./

# تثبيت المكتبات بدون تشغيل الـ postinstall لتجنب خطأ بريزما
RUN npm install --omit=dev --ignore-scripts

# نسخ كل ملفات المشروع (بما فيها فولدر prisma)
COPY . .

# تشغيل توليد بريزما يدوياً بعد ما الملفات اتنسخت
RUN npx prisma generate

EXPOSE 5000

CMD ["node", "server.js"]
