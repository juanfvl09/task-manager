# Task Manager

Plataforma de gestión de tareas construida como un sistema de contenedores Docker que se comunican entre sí a través de una red personalizada. Proyecto académico de la asignatura **Integración Continua** del Politécnico Grancolombiano (Entrega Proyecto 1, Escenario 3).

## Índice

1. [Descripción](#1-descripción)
2. [Objetivo académico](#2-objetivo-académico)
3. [Tecnologías utilizadas](#3-tecnologías-utilizadas)
4. [Arquitectura](#4-arquitectura)
5. [Diagrama de contenedores](#5-diagrama-de-contenedores)
6. [Requisitos previos](#6-requisitos-previos)
7. [Instalación](#7-instalación)
8. [Configuración del `.env`](#8-configuración-del-env)
9. [Construcción de imágenes](#9-construcción-de-imágenes)
10. [Levantamiento de servicios](#10-levantamiento-de-servicios)
11. [Comandos de Docker Compose](#11-comandos-de-docker-compose)
12. [Endpoints disponibles](#12-endpoints-disponibles)
13. [Prueba de comunicación entre contenedores](#13-prueba-de-comunicación-entre-contenedores)
14. [Prueba de balanceo de carga](#14-prueba-de-balanceo-de-carga)
15. [Persistencia de datos](#15-persistencia-de-datos)
16. [Ejecución del pipeline](#16-ejecución-del-pipeline)
17. [Solución de problemas comunes](#17-solución-de-problemas-comunes)
18. [Documentación adicional](#18-documentación-adicional)

## 1. Descripción

Task Manager permite crear, consultar, actualizar, completar y eliminar tareas desde una interfaz web. La aplicación está dividida en cinco contenedores:

- Un balanceador Nginx que es el único punto de entrada.
- Un frontend Vue 3 compilado y servido como archivos estáticos.
- Dos instancias idénticas de una API REST en NestJS.
- Una base de datos PostgreSQL con almacenamiento persistente.

## 2. Objetivo académico

Demostrar de forma práctica:

- La construcción de imágenes Docker propias con Dockerfiles multi-stage.
- El uso de imágenes base oficiales con versiones fijas.
- La comunicación entre contenedores mediante una red Docker personalizada y nombres DNS.
- La persistencia de datos con volúmenes.
- La orquestación con Docker Compose, incluyendo dependencias y healthchecks.
- El balanceo de carga entre dos instancias del backend con Nginx.
- La construcción automática de las imágenes con GitHub Actions.

## 3. Tecnologías utilizadas

| Capa | Tecnología | Versión |
|---|---|---|
| Frontend | Vue 3, TypeScript, Vite | Vue 3.5, Vite 8 |
| Backend | NestJS, TypeORM, class-validator | NestJS 12, TypeORM 0.3 |
| Base de datos | PostgreSQL | 16.15 |
| Runtime | Node.js | 22.23.4 (imagen `node:22.23.4-alpine3.24`) |
| Proxy y balanceo | Nginx | 1.30.6 (imagen `nginx:1.30.6-alpine`) |
| Contenedores | Docker Engine, Docker Compose | Docker 29, Compose v5 |
| Integración continua | GitHub Actions | - |

## 4. Arquitectura

| Servicio | Imagen | Rol | Puerto interno | Puerto en el host |
|---|---|---|---|---|
| `nginx-lb` | `nginx:1.30.6-alpine` | Reverse proxy y balanceador | 80 | 8080 |
| `frontend` | `taskmanager-frontend` (propia) | SPA Vue servida por Nginx | 80 | - |
| `backend-1` | `taskmanager-backend` (propia) | API NestJS, instancia 1 | 3000 | - |
| `backend-2` | `taskmanager-backend` (propia) | API NestJS, instancia 2 | 3000 | - |
| `postgres` | `postgres:16.15-alpine3.24` | Base de datos | 5432 | - |

Todos los servicios pertenecen a la red `taskmanager-network` (driver `bridge`). Solo `nginx-lb` publica un puerto en el host. El backend se conecta a la base de datos usando el nombre de servicio `postgres` como hostname; nunca `localhost` ni direcciones IP.

Flujo de una petición:

1. El navegador abre `http://localhost:8080`.
2. `nginx-lb` recibe la petición. Si la ruta empieza por `/api/` la envía, alternando, a `backend-1:3000` o `backend-2:3000`. Cualquier otra ruta se envía a `frontend:80`.
3. El backend consulta o modifica datos en `postgres:5432`.
4. PostgreSQL guarda los datos en el volumen `postgres-data`.

El detalle completo está en [docs/arquitectura.md](docs/arquitectura.md).

## 5. Diagrama de contenedores

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

## 6. Requisitos previos

- Docker Engine 24 o superior con Docker Compose v2 (se probó con Docker 29 y Compose v5).
- Git.
- `curl` y `bash` para ejecutar el script de pruebas (en Windows, Git Bash).

No es necesario tener Node.js instalado: la compilación del backend y del frontend se realiza dentro de Docker.

## 7. Instalación

```bash
git clone https://github.com/juanfvl09/task-manager.git
cd task-manager
cp .env.example .env
```

Edita `.env` y reemplaza la contraseña de ejemplo por una propia.

## 8. Configuración del `.env`

El archivo `.env` vive en la raíz y nunca se sube al repositorio (está en `.gitignore`). Plantilla en `.env.example`:

| Variable | Descripción | Valor de ejemplo |
|---|---|---|
| `DB_NAME` | Nombre de la base de datos | `taskmanager` |
| `DB_USER` | Usuario de PostgreSQL | `taskmanager_user` |
| `DB_PASSWORD` | Contraseña del usuario | `CHANGE_ME_TO_A_STRONG_PASSWORD` |
| `DB_PORT` | Puerto interno de PostgreSQL | `5432` |
| `APP_PORT` | Puerto publicado en el host por Nginx | `8080` |

Docker Compose toma estas variables y las inyecta en `postgres` (como `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`) y en ambos backends (como `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_PORT`). Además fija directamente `DB_HOST=postgres` y el `INSTANCE_NAME` de cada backend.

## 9. Construcción de imágenes

Construir solo las imágenes, sin arrancar nada:

```bash
docker compose build
```

Construir una imagen de forma individual:

```bash
docker build -t taskmanager-backend ./backend
docker build -t taskmanager-frontend ./frontend
```

Ambos Dockerfiles son multi-stage: una etapa `builder` instala dependencias con `npm ci` y compila; la etapa final solo contiene lo necesario para ejecutar. El backend corre con el usuario `node` (no root) y `NODE_ENV=production`.

## 10. Levantamiento de servicios

```bash
docker compose up -d --build
```

Cuando todos los contenedores estén sanos, abre `http://localhost:8080` en el navegador.

Para verificar el estado:

```bash
docker compose ps
```

Los cinco servicios deben mostrar `healthy`.

## 11. Comandos de Docker Compose

| Acción | Comando |
|---|---|
| Levantar todo (construyendo imágenes) | `docker compose up -d --build` |
| Ver estado de los contenedores | `docker compose ps` |
| Ver logs de todos los servicios | `docker compose logs -f` |
| Ver logs de un servicio | `docker compose logs -f backend-1` |
| Reiniciar un servicio | `docker compose restart backend-1` |
| Inspeccionar la red | `docker network inspect taskmanager-network` |
| Inspeccionar el volumen | `docker volume inspect postgres-data` |
| Entrar a la base de datos | `docker compose exec postgres psql -U taskmanager_user -d taskmanager` |
| Detener y eliminar contenedores | `docker compose down` |
| Detener y **borrar los datos** | `docker compose down -v` |

`docker compose down` conserva el volumen `postgres-data`, por lo que las tareas siguen existiendo al volver a levantar. `docker compose down -v` elimina el volumen y no debe usarse como comando habitual.

## 12. Endpoints disponibles

Base: `http://localhost:8080/api`

| Método | Ruta | Descripción | Respuesta |
|---|---|---|---|
| `GET` | `/api/tasks` | Lista todas las tareas | `200` lista de tareas |
| `GET` | `/api/tasks/:id` | Obtiene una tarea | `200` tarea / `404` |
| `POST` | `/api/tasks` | Crea una tarea | `201` tarea creada / `400` |
| `PATCH` | `/api/tasks/:id` | Actualiza título o descripción | `200` tarea / `404` |
| `PATCH` | `/api/tasks/:id/status` | Cambia el estado (`PENDING` o `COMPLETED`) | `200` tarea / `400` |
| `DELETE` | `/api/tasks/:id` | Elimina una tarea | `204` / `404` |
| `GET` | `/api/health` | Estado del backend y de la base de datos | `200` / `503` |
| `GET` | `/api/instance` | Instancia que atendió la petición | `200` |

Cuerpo para crear una tarea:

```json
{ "title": "Preparar la sustentación", "description": "Opcional" }
```

Cuerpo para cambiar el estado:

```json
{ "status": "COMPLETED" }
```

Todas las respuestas incluyen la cabecera `X-Backend-Instance` con el nombre de la instancia que respondió. El frontend la usa para mostrar qué backend atendió cada operación.

## 13. Prueba de comunicación entre contenedores

Con los servicios levantados, el script hace una operación real de ida y vuelta entre NestJS y PostgreSQL pasando por Nginx:

```bash
bash scripts/test-communication.sh
```

Comprueba la disponibilidad de la API y de la base de datos, crea una tarea, la consulta por id y en el listado, hace diez peticiones a `/api/instance` y exige que respondan ambas instancias. Termina con código `0` si todo pasa y `1` si algo falla. Para conservar la tarea creada: `KEEP_TASK=1 bash scripts/test-communication.sh`.

Paso a paso manual:

```bash
# 1. Crear una tarea a través de Nginx
curl -X POST http://localhost:8080/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Tarea de prueba","description":"Creada por HTTP"}'

# 2. Consultar las tareas
curl http://localhost:8080/api/tasks

# 3. Confirmar la fila directamente en PostgreSQL
docker compose exec postgres psql -U taskmanager_user -d taskmanager \
  -c 'SELECT id, title, status FROM tasks;'

# 4. Comprobar que el backend usa el hostname postgres
docker compose exec backend-1 sh -c 'echo $DB_HOST; getent hosts postgres'
```

El procedimiento completo, con los resultados obtenidos, está en [docs/pruebas.md](docs/pruebas.md).

## 14. Prueba de balanceo de carga

```bash
for i in $(seq 1 10); do curl -s http://localhost:8080/api/instance; echo; done
```

Las respuestas alternan entre `backend-1` y `backend-2`. En los logs de Nginx se ve a qué upstream fue cada petición:

```bash
docker compose logs nginx-lb | grep /api/instance
```

## 15. Persistencia de datos

```bash
# Crear una tarea y anotar su id
curl -X POST http://localhost:8080/api/tasks -H "Content-Type: application/json" -d '{"title":"Persistencia"}'

# Reiniciar los backends y consultar de nuevo
docker compose restart backend-1 backend-2
curl http://localhost:8080/api/tasks

# Reiniciar PostgreSQL y consultar de nuevo
docker compose restart postgres
curl http://localhost:8080/api/tasks
```

La tarea sigue apareciendo en ambos casos porque los datos están en el volumen `postgres-data`, no dentro del contenedor.

## 16. Ejecución del pipeline

El workflow `.github/workflows/ci.yml` se ejecuta en cada push a `main` o `develop` y en cada pull request hacia `main`. Tiene tres jobs:

| Job | Qué hace |
|---|---|
| `backend` | `npm ci`, lint, pruebas unitarias, pruebas e2e y `npm run build` |
| `frontend` | `npm ci` y `npm run build` (type-check + Vite) |
| `docker` | Construye ambas imágenes con Buildx, valida `docker-compose.yml` con `docker compose config` y valida `nginx.conf` con `nginx -t` |

El pipeline no publica imágenes ni necesita secretos ni bases de datos externas. El resultado se consulta en la pestaña **Actions** del repositorio.

Para reproducir localmente las mismas verificaciones sin Node.js instalado:

```bash
docker build --target builder -t taskmanager-backend-builder ./backend
docker run --rm taskmanager-backend-builder npm test
docker run --rm taskmanager-backend-builder npm run test:e2e
docker run --rm taskmanager-backend-builder npm run lint
docker compose config --quiet
```

## 17. Solución de problemas comunes

**El puerto 8080 está ocupado.** Cambia `APP_PORT` en `.env` (por ejemplo `APP_PORT=8081`) y vuelve a ejecutar `docker compose up -d`.

**`docker compose` muestra advertencias de variables vacías.** Falta el archivo `.env`. Crea uno a partir de `.env.example`.

**Un backend queda `unhealthy`.** Revisa `docker compose logs backend-1`. Normalmente es una contraseña distinta entre `.env` y la base de datos ya inicializada. Si cambiaste `DB_PASSWORD` después del primer arranque, el volumen conserva la contraseña anterior; usa la original o elimina el volumen con `docker compose down -v` (se pierden los datos).

**Nginx no arranca con `host not found in upstream`.** Nginx resuelve los nombres `backend-1`, `backend-2` y `frontend` al iniciar. Compose lo arranca solo cuando esos servicios están sanos; si levantas `nginx-lb` por separado, asegúrate de que los demás estén activos.

**Cambié código y no veo los cambios.** Las imágenes no se reconstruyen solas. Ejecuta `docker compose up -d --build`.

**El script de pruebas falla en Windows.** Ejecútalo con Git Bash: `bash scripts/test-communication.sh`.

**Quiero empezar desde cero.** `docker compose down -v` elimina contenedores, red y volumen. La siguiente ejecución de `docker compose up -d --build` creará todo de nuevo.

## 18. Documentación adicional

- [docs/arquitectura.md](docs/arquitectura.md): arquitectura, decisiones técnicas y resolución de nombres.
- [docs/pruebas.md](docs/pruebas.md): procedimiento de pruebas y resultados obtenidos.
- [docs/evidencias.md](docs/evidencias.md): base del documento de entrega con espacios para capturas.
- [docs/referencias.md](docs/referencias.md): referencias en formato APA 7.
