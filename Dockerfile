FROM node:18-slim

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

RUN npx prisma generate

COPY . .

EXPOSE 5000

CMD ["node", "server.js"]
