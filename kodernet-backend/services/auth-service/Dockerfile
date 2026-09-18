FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

EXPOSE 4001

CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
