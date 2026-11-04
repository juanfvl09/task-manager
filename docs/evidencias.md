# Documento de evidencias

> Base en Markdown para generar el PDF de entrega. Los bloques marcados como **[CAPTURA PENDIENTE]** deben reemplazarse por capturas reales tomadas en la máquina del estudiante. Los resultados en texto corresponden a la ejecución de referencia del 4 de noviembre de 2026 documentada en `pruebas.md`.

---

## Portada

**Politécnico Grancolombiano**
**Facultad de Ingeniería de Software**

**Asignatura:** Integración Continua

**Entrega Proyecto 1 — Escenario 3**

**Proyecto:** Task Manager — Plataforma de gestión de tareas

**Estudiante:** Juan Felipe Valencia Ledezma

**Docente:** John Alirio Olarte Ramos

**Fecha:** 7 de noviembre de 2026

---

## Tabla de contenido

1. Introducción
2. Objetivos
3. Descripción de la solución
4. Arquitectura de Docker
5. Descripción de los servicios
6. Configuración de Dockerfiles
7. Configuración de Docker Compose
8. Configuración de Docker Network
9. Comunicación entre contenedores
10. Prueba de persistencia
11. Prueba de balanceo de carga
12. Pipeline de GitHub Actions
13. Buenas prácticas de seguridad
14. Conclusiones
15. Referencias

---

## 1. Introducción

La contenerización permite empaquetar una aplicación junto con todas sus dependencias en una unidad reproducible que se ejecuta igual en cualquier máquina. Cuando una solución se compone de varios servicios, aparecen nuevas necesidades: que los contenedores se encuentren entre sí, que arranquen en el orden correcto, que los datos sobrevivan a los reinicios y que la construcción de las imágenes se pueda automatizar.

Este documento presenta Task Manager, una aplicación de gestión de tareas construida como un sistema de cinco contenedores Docker orquestados con Docker Compose. El proyecto demuestra la construcción de imágenes propias, la comunicación entre contenedores a través de una red personalizada, la persistencia de datos en PostgreSQL mediante un volumen, el balanceo de carga con Nginx y la automatización de la construcción con GitHub Actions.

## 2. Objetivos

### Objetivo general

Construir y documentar una aplicación distribuida y contenerizada que demuestre la comunicación entre contenedores Docker mediante una red personalizada y la automatización de la construcción de imágenes con GitHub Actions.

### Objetivos específicos

- Construir imágenes Docker propias para el backend y el frontend con Dockerfiles multi-stage.
- Utilizar imágenes base oficiales con versiones fijas.
- Orquestar los servicios con Docker Compose, incluyendo dependencias, healthchecks y política de reinicio.
- Comunicar el backend con PostgreSQL usando el nombre de servicio `postgres` resuelto por el DNS interno de Docker.
- Persistir los datos en un volumen Docker y comprobar que sobreviven a reinicios.
- Balancear las peticiones entre dos instancias del backend con Nginx.
- Automatizar la validación, las pruebas y la construcción de imágenes con GitHub Actions.

## 3. Descripción de la solución

Task Manager permite crear, consultar, editar, completar y eliminar tareas desde una interfaz web. Cada tarea tiene un identificador UUID, un título, una descripción opcional, un estado (`PENDING` o `COMPLETED`) y fechas de creación y actualización.

La solución está formada por:

- **Frontend:** aplicación Vue 3 con TypeScript, compilada con Vite y servida como archivos estáticos por Nginx. Consume la API con la ruta relativa `/api`.
- **Backend:** API REST en NestJS con TypeORM y validación de DTOs. Se ejecutan dos instancias idénticas.
- **Base de datos:** PostgreSQL 16 con los datos en un volumen persistente.
- **Balanceador:** Nginx como reverse proxy. Es el único servicio con un puerto publicado en el host.

Repositorio: https://github.com/juanfvl09/task-manager

## 4. Arquitectura de Docker

```
                         Host (máquina del usuario)
   ┌──────────────────────────────────────────────────────────────────┐
   │   Navegador ──► http://localhost:8080                            │
   │                        │                                         │
   │   ╔════════════════════╪═══════ taskmanager-network (bridge) ═══╗│
   │   ║                    ▼                                        ║│
   │   ║            ┌──────────────┐                                 ║│
   │   ║            │   nginx-lb   │  :80                            ║│
   │   ║            └──────┬───────┘                                 ║│
   │   ║        /          │          /api/                          ║│
   │   ║   ┌───────────────┴──────────────────┐                      ║│
   │   ║   ▼                                  ▼  (round-robin)       ║│
   │   ║ ┌──────────┐              ┌───────────┐   ┌───────────┐     ║│
   │   ║ │ frontend │ :80          │ backend-1 │   │ backend-2 │     ║│
   │   ║ │ Vue+Nginx│              │  NestJS   │   │  NestJS   │     ║│
   │   ║ └──────────┘              └─────┬─────┘   └─────┬─────┘     ║│
   │   ║                                 │  :3000        │           ║│
   │   ║                                 └───────┬───────┘           ║│
   │   ║                                         ▼  DB_HOST=postgres ║│
   │   ║                                  ┌─────────────┐            ║│
   │   ║                                  │  postgres   │ :5432      ║│
   │   ║                                  └──────┬──────┘            ║│
   │   ╚═════════════════════════════════════════╪════════════════════╝│
   │                                             ▼                     │
   │                                   volumen postgres-data           │
   └──────────────────────────────────────────────────────────────────┘
```

Flujo de una petición:

1. El usuario abre `http://localhost:8080`.
2. Docker enruta el puerto 8080 del host al puerto 80 del contenedor `nginx-lb`.
3. Nginx envía las rutas `/api/` al grupo de backends y el resto al frontend.
4. El backend se conecta a `postgres:5432` para leer o escribir.
5. PostgreSQL persiste los datos en el volumen `postgres-data`.

## 5. Descripción de los servicios

| Servicio | Imagen | Función | Puerto interno | Publicado |
|---|---|---|---|---|
| `nginx-lb` | `nginx:1.30.6-alpine` | Reverse proxy y balanceador round-robin | 80 | 8080 |
| `frontend` | Propia, `frontend/Dockerfile` | SPA Vue compilada, servida por Nginx | 80 | No |
| `backend-1` | Propia, `backend/Dockerfile` | API NestJS, `INSTANCE_NAME=backend-1` | 3000 | No |
| `backend-2` | Propia, `backend/Dockerfile` | API NestJS, `INSTANCE_NAME=backend-2` | 3000 | No |
| `postgres` | `postgres:16.15-alpine3.24` | Base de datos relacional | 5432 | No |

Endpoints de la API:

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/tasks` | Listar tareas |
| GET | `/api/tasks/:id` | Consultar una tarea |
| POST | `/api/tasks` | Crear una tarea |
| PATCH | `/api/tasks/:id` | Actualizar una tarea |
| PATCH | `/api/tasks/:id/status` | Cambiar el estado |
| DELETE | `/api/tasks/:id` | Eliminar una tarea |
| GET | `/api/health` | Estado del backend y de la base de datos |
| GET | `/api/instance` | Instancia que atendió la petición |

## 6. Configuración de Dockerfiles

### Backend (`backend/Dockerfile`)

Construcción en dos etapas sobre `node:22.23.4-alpine3.24`:

1. **builder:** copia `package.json` y `package-lock.json`, ejecuta `npm ci`, copia el código fuente y ejecuta `npm run build`.
2. **production:** fija `NODE_ENV=production`, instala solo dependencias de producción con `npm ci --omit=dev`, copia el directorio `dist` de la etapa anterior, cambia al usuario `node`, expone el puerto 3000 y arranca con `node dist/main.js`.

No se copia `node_modules` desde la máquina local y la imagen final no incluye herramientas de desarrollo.

**[CAPTURA PENDIENTE] Construcción de la imagen del backend** (`docker compose build backend-1` o `docker build ./backend`), mostrando las etapas `builder` y `production`.

### Frontend (`frontend/Dockerfile`)

1. **builder:** sobre `node:22.23.4-alpine3.24`, `npm ci` y `npm run build` (type-check con `vue-tsc` y compilación con Vite).
2. **production:** sobre `nginx:1.30.6-alpine`, copia la configuración de Nginx y los archivos estáticos generados en `dist`.

**[CAPTURA PENDIENTE] Construcción de la imagen del frontend**, mostrando la salida de `vite build`.

### Archivos `.dockerignore`

Ambos servicios excluyen `node_modules`, `dist`, `coverage`, `.git`, `.env`, logs, temporales y el propio `Dockerfile`, para que el contexto de construcción sea pequeño y nunca se copien dependencias locales.

## 7. Configuración de Docker Compose

El archivo `docker-compose.yml` define:

- Los cinco servicios, con `build` para las imágenes propias e `image` fija para las oficiales.
- La red `taskmanager-network` (driver `bridge`).
- El volumen `postgres-data` montado en `/var/lib/postgresql/data`.
- Variables de entorno tomadas de `.env` (`DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_PORT`, `APP_PORT`) y fijadas en el propio archivo (`DB_HOST=postgres`, `INSTANCE_NAME`).
- Healthchecks: `pg_isready` para PostgreSQL, `GET /api/health` para los backends, `GET /` para el frontend y el balanceador.
- `depends_on` con `condition: service_healthy`, de modo que los backends solo arrancan cuando PostgreSQL acepta conexiones y Nginx solo cuando los backends y el frontend están sanos.
- `restart: unless-stopped` en todos los servicios.
- Un único puerto publicado: `${APP_PORT:-8080}:80` en `nginx-lb`.

**[CAPTURA PENDIENTE] Ejecución de `docker compose up -d --build`**, mostrando la secuencia `Waiting` / `Healthy` / `Started`.

**[CAPTURA PENDIENTE] Resultado de `docker compose ps`** con los cinco contenedores en estado `healthy`.

Resultado obtenido en la ejecución de referencia:

```
NAME                    STATUS                   PORTS
taskmanager-backend-1   Up (healthy)             3000/tcp
taskmanager-backend-2   Up (healthy)             3000/tcp
taskmanager-frontend    Up (healthy)             80/tcp
taskmanager-nginx-lb    Up (healthy)             0.0.0.0:8080->80/tcp
taskmanager-postgres    Up (healthy)             5432/tcp
```

## 8. Configuración de Docker Network

Compose crea la red `taskmanager-network` de tipo `bridge` y conecta a ella los cinco contenedores. Docker ofrece un servidor DNS interno en cada red definida por el usuario, de modo que cada contenedor puede alcanzar a los demás por el nombre del servicio: `postgres`, `backend-1`, `backend-2`, `frontend`.

Esto permite que el backend use `DB_HOST=postgres` y que Nginx declare `server backend-1:3000` sin conocer ninguna dirección IP. Si un contenedor se reinicia y cambia de IP, el nombre sigue resolviendo.

**[CAPTURA PENDIENTE] Resultado de `docker network inspect taskmanager-network`**, mostrando el driver `bridge` y los cinco contenedores conectados.

Resultado obtenido en la ejecución de referencia:

```
taskmanager-network driver=bridge
  taskmanager-postgres  = 192.168.16.2/20
  taskmanager-frontend  = 192.168.16.3/20
  taskmanager-backend-2 = 192.168.16.4/20
  taskmanager-backend-1 = 192.168.16.5/20
  taskmanager-nginx-lb  = 192.168.16.6/20
```

## 9. Comunicación entre contenedores

La prueba consiste en crear una tarea por HTTP y comprobar que la fila existe en PostgreSQL.

1. Creación por HTTP a través de Nginx:

```
POST http://localhost:8080/api/tasks
HTTP/1.1 201 Created
X-Backend-Instance: backend-1
{"id":"d3f15c08-f109-4de0-8e57-99a6440d844c","status":"PENDING",
 "createdAt":"2026-11-04T17:03:16.342Z", ...}
```

**[CAPTURA PENDIENTE] Resultado de la creación de una tarea** (respuesta de `curl` o de la interfaz web).

2. Consulta por la API:

```
GET http://localhost:8080/api/tasks/d3f15c08-f109-4de0-8e57-99a6440d844c  ->  200 OK
```

**[CAPTURA PENDIENTE] Resultado de la consulta de una tarea.**

3. Fila real en PostgreSQL, consultada con `psql` dentro del contenedor:

```
                  id                  | status  |         createdAt
--------------------------------------+---------+----------------------------
 d3f15c08-f109-4de0-8e57-99a6440d844c | PENDING | 2026-11-04 17:03:16.342877
```

4. Evidencia de que el backend se conecta por el hostname `postgres`:

```
$ docker compose exec backend-1 sh -c 'echo DB_HOST=$DB_HOST; getent hosts postgres'
DB_HOST=postgres
192.168.16.2      postgres  postgres
```

Y desde el lado de PostgreSQL, las conexiones llegan desde la IP interna del backend:

```
 client_addr  | count
--------------+-------
 192.168.16.5 |     1
```

**[CAPTURA PENDIENTE] Evidencia de comunicación mediante el hostname `postgres`** (salida de los dos comandos anteriores).

## 10. Prueba de persistencia

1. Se reiniciaron ambos backends con `docker compose restart backend-1 backend-2`. La tarea `d3f15c08-...` siguió respondiendo en `GET /api/tasks/:id`.
2. Se reinició PostgreSQL con `docker compose restart postgres`. La tarea siguió disponible y `/api/health` devolvió `"database":"up"`.

Los datos sobreviven porque el directorio de datos de PostgreSQL está en el volumen `postgres-data`, no en la capa de escritura del contenedor.

```
$ docker volume inspect postgres-data
postgres-data local /var/lib/docker/volumes/postgres-data/_data
```

**[CAPTURA PENDIENTE] Evidencia de persistencia después de reiniciar contenedores** (consulta de la tarea antes y después de los reinicios).

## 11. Prueba de balanceo de carga

Nginx define un `upstream` con `backend-1:3000` y `backend-2:3000` y reparte las peticiones en round-robin. Cada instancia responde en `/api/instance` con el valor de su variable `INSTANCE_NAME` y su hostname (el ID del contenedor).

Resultado de diez peticiones consecutivas con `scripts/test-communication.sh`:

```
  petición  1 -> backend-1
  petición  2 -> backend-2
  petición  3 -> backend-1
  petición  4 -> backend-2
  petición  5 -> backend-1
  petición  6 -> backend-2
  petición  7 -> backend-1
  petición  8 -> backend-2
  petición  9 -> backend-1
  petición 10 -> backend-2
  [OK]    Respondieron 2 instancias distintas:
              5 backend-1
              5 backend-2
```

Los logs de Nginx confirman el upstream usado en cada petición:

```
"GET /api/instance HTTP/1.1" 200 upstream=192.168.16.5:3000
"GET /api/instance HTTP/1.1" 200 upstream=192.168.16.4:3000
"GET /api/instance HTTP/1.1" 200 upstream=192.168.16.5:3000
"GET /api/instance HTTP/1.1" 200 upstream=192.168.16.4:3000
```

**[CAPTURA PENDIENTE] Resultado de las dos instancias backend** (salida del script o del bucle de `curl`, y opcionalmente el indicador de instancia en la interfaz web).

## 12. Pipeline de GitHub Actions

El workflow `.github/workflows/ci.yml` se ejecuta en cada push a `main` o `develop` y en cada pull request hacia `main`. Consta de tres jobs:

| Job | Pasos |
|---|---|
| `backend` | checkout, Node.js 22, `npm ci`, lint, pruebas unitarias, pruebas e2e, `npm run build` |
| `frontend` | checkout, Node.js 22, `npm ci`, `npm run build` |
| `docker` | Buildx, construcción de la imagen del backend, construcción de la imagen del frontend, `docker compose config`, `nginx -t` |

El job `docker` depende de que `backend` y `frontend` terminen correctamente. No se publican imágenes ni se usan secretos.

**[CAPTURA PENDIENTE] Pipeline de GitHub Actions en verde** (pestaña Actions del repositorio con los tres jobs completados).

Estado: pendiente de ejecución hasta el primer push al repositorio.

## 13. Buenas prácticas de seguridad

- Imágenes base oficiales con versión fija; no se usa `latest`.
- Construcción multi-stage: la imagen final del backend no contiene código fuente ni dependencias de desarrollo.
- El backend se ejecuta con el usuario `node`, no con root.
- Solo Nginx publica un puerto en el host; PostgreSQL y los backends no son accesibles desde fuera de la red Docker.
- Las credenciales se cargan desde `.env`, que está excluido de Git. El repositorio solo incluye `.env.example` con valores de ejemplo.
- Los archivos `.dockerignore` evitan copiar `.env`, `node_modules` y otros archivos locales a las imágenes.
- Los DTOs se validan con `class-validator` (`whitelist` y `forbidNonWhitelisted`), de modo que se rechazan campos no esperados.
- El pipeline funciona sin secretos de GitHub.

## 14. Conclusiones

- Docker Compose simplifica la orquestación de varios contenedores: una sola definición declara servicios, red, volumen, dependencias y healthchecks, y un solo comando levanta todo el sistema.
- La red personalizada y el DNS interno de Docker permiten que los servicios se comuniquen por nombre. El backend se conectó a PostgreSQL usando el hostname `postgres` sin conocer ninguna IP, lo cual se comprobó tanto desde el contenedor del backend como desde las conexiones registradas por PostgreSQL.
- Los healthchecks combinados con `depends_on: condition: service_healthy` evitan errores de arranque: los backends no intentan conectarse hasta que PostgreSQL está listo, y Nginx no arranca hasta que sus upstreams existen.
- El volumen `postgres-data` garantiza la persistencia: las tareas creadas sobrevivieron al reinicio de los backends y de la propia base de datos.
- Nginx distribuyó las peticiones entre las dos instancias del backend de forma alterna, lo cual se verificó por las respuestas de `/api/instance` y por los logs del balanceador.
- La construcción multi-stage dentro de Docker elimina la dependencia de un entorno Node.js local y produce imágenes finales más pequeñas y seguras.
- GitHub Actions permite validar en cada cambio que el código compila, que las pruebas pasan y que las imágenes se pueden construir.

## 15. Referencias

Ver `docs/referencias.md` (formato APA 7).
