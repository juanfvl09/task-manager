# Etapa 1: compilación
FROM node:22.23.4-alpine3.24 AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Etapa 2: imagen de producción
FROM node:22.23.4-alpine3.24 AS production

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]
