FROM node:20-slim

# تثبيت OpenSSL لأنه مطلوب لـ Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

ENV PRISMA_SKIP_POSTINSTALL_GENERATE=1

WORKDIR /app

# نسخ ملفات التعريف أولاً
COPY package*.json ./

# تثبيت المكتبات بدون تشغيل الـ postinstall لتجنب خطأ بريزما مع إضافة إعدادات الشبكة لتجنب انقطاع الاتصال (ECONNRESET)
RUN npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-retries 5 && \
    npm install --omit=dev --ignore-scripts --no-audit && \
    npm cache clean --force

# نسخ كل ملفات المشروع (بما فيها فولدر prisma)
COPY . .

# تشغيل توليد بريزما يدوياً بعد ما الملفات اتنسخت
RUN npx prisma generate

EXPOSE 5000

CMD ["npm", "start"]
