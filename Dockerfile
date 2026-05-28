FROM node:22-alpine AS builder
WORKDIR /app
COPY client/package.json ./client/
COPY server/package.json ./server/
WORKDIR /app/client
RUN npm install
COPY client/ ./
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY server/package.json ./
RUN npm install --omit=dev
COPY server/index.js ./
COPY --from=builder /app/client/dist ./client/dist
ENV PORT=3001
EXPOSE 3001
CMD ["node", "index.js"]
