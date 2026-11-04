# Etapa 1: compilación de la aplicación Vue
FROM node:22.23.4-alpine3.24 AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Etapa 2: servidor de archivos estáticos
FROM nginx:1.30.6-alpine AS production

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
