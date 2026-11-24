# Balanceador: la misma imagen de Nginx con la configuración incluida,
# así Jenkins puede levantar el stack sin depender de rutas del host.
FROM nginx:1.30.6-alpine

COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
