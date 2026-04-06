FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
COPY backend/package*.json backend/
COPY frontend/package*.json frontend/

RUN npm install

COPY . .

RUN cd backend && npx prisma generate
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["sh", "-lc", "cd backend && npm run start:prod"]
