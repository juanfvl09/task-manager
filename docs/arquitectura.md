# Arquitectura de Task Manager

## 1. Descripción general

Task Manager es una aplicación de gestión de tareas construida como un sistema distribuido de cinco contenedores que se comunican entre sí a través de una red Docker personalizada. El objetivo es demostrar, de forma pequeña y verificable, cómo se construyen imágenes propias, cómo se orquestan con Docker Compose, cómo se comunican los servicios por nombre DNS y cómo se automatiza la construcción con GitHub Actions.

El único punto de entrada desde el host es el puerto `8080`, atendido por Nginx. Todo lo demás vive dentro de la red `taskmanager-network` y no es accesible directamente desde fuera.

## 2. Servicios

| Servicio | Imagen | Rol | Puerto interno | Publicado al host |
|---|---|---|---|---|
| `nginx-lb` | `nginx:1.30.6-alpine` | Reverse proxy y balanceador de carga | 80 | Sí, `8080:80` |
| `frontend` | Propia (`frontend/Dockerfile`) | SPA Vue 3 compilada y servida por Nginx | 80 | No |
| `backend-1` | Propia (`backend/Dockerfile`) | API REST NestJS, instancia 1 | 3000 | No |
| `backend-2` | Propia (`backend/Dockerfile`) | API REST NestJS, instancia 2 | 3000 | No |
| `postgres` | `postgres:16.15-alpine3.24` | Base de datos relacional | 5432 | No |

`backend-1` y `backend-2` se construyen a partir de la **misma imagen**. La única diferencia entre ambos es la variable de entorno `INSTANCE_NAME`, que cada instancia devuelve en `GET /api/instance`. Así se puede comprobar desde el navegador o con `curl` que Nginx reparte las peticiones entre las dos.

### Versiones de imágenes base

Todas las imágenes base se fijan a una versión concreta para que la construcción sea reproducible en cualquier máquina y en el pipeline de CI:

| Uso | Imagen |
|---|---|
| Compilación y ejecución de NestJS | `node:22.23.4-alpine3.24` |
| Compilación de Vue | `node:22.23.4-alpine3.24` |
| Servidor de estáticos del frontend y balanceador | `nginx:1.30.6-alpine` |
| Base de datos | `postgres:16.15-alpine3.24` |

Se eligen variantes Alpine por su tamaño reducido. No se usa la etiqueta `latest` en ningún caso.

## 3. Diagrama de contenedores

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

## 4. Flujo de una petición

1. El usuario abre `http://localhost:8080` en el navegador.
2. Docker enruta el puerto `8080` del host al puerto `80` del contenedor `nginx-lb`.
3. Nginx evalúa la ruta:
   - Si empieza por `/api/`, la envía al `upstream` formado por `backend-1:3000` y `backend-2:3000`.
   - En cualquier otro caso, la envía a `frontend:80`, que devuelve los archivos estáticos de Vue.
4. La instancia de NestJS que recibe la petición ejecuta la lógica de negocio y, si necesita datos, se conecta a PostgreSQL usando el hostname `postgres` y el puerto `5432`.
5. PostgreSQL responde y persiste los cambios en el volumen `postgres-data`.
6. La respuesta vuelve por el mismo camino hasta el navegador.

El frontend consume la API con la ruta relativa `/api`. Nunca conoce la dirección de los backends: siempre habla con el mismo origen desde el que fue servido, y es Nginx quien decide a dónde va cada petición.

## 5. Resolución de nombres

Docker Compose crea automáticamente un servidor DNS interno para cada red definida por el usuario. Cada contenedor es alcanzable por el nombre de su servicio (`postgres`, `frontend`, `backend-1`, `backend-2`). Esto es lo que permite que:

- NestJS use `DB_HOST=postgres` sin saber la IP del contenedor de base de datos.
- Nginx declare `server backend-1:3000;` y `server backend-2:3000;` en su `upstream`.

No se usan direcciones IP fijas en ningún archivo del proyecto. Si un contenedor se reinicia y cambia de IP, el nombre sigue resolviendo correctamente.

Nginx resuelve los nombres del `upstream` en el arranque. Por eso `nginx-lb` declara `depends_on` sobre los dos backends: así se garantiza que los nombres existan cuando Nginx lea su configuración.

## 6. Modelo de datos

Una única entidad `Task`, gestionada con TypeORM:

| Campo | Tipo PostgreSQL | Notas |
|---|---|---|
| `id` | `uuid` | Clave primaria, generada automáticamente |
| `title` | `varchar(150)` | Obligatorio |
| `description` | `text` | Opcional |
| `status` | `enum('PENDING','COMPLETED')` | Por defecto `PENDING` |
| `createdAt` | `timestamp` | Se asigna al crear |
| `updatedAt` | `timestamp` | Se actualiza en cada cambio |

Para este MVP se usa `synchronize: true` en TypeORM, de modo que la tabla se cree sola al arrancar el backend. En un entorno real se reemplazaría por migraciones, pero para la demostración simplifica el arranque y evita pasos manuales.

## 7. API REST

Todos los endpoints cuelgan del prefijo `/api`:

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/tasks` | Listar tareas |
| `GET` | `/api/tasks/:id` | Obtener una tarea |
| `POST` | `/api/tasks` | Crear tarea |
| `PATCH` | `/api/tasks/:id` | Actualizar título o descripción |
| `PATCH` | `/api/tasks/:id/status` | Cambiar estado |
| `DELETE` | `/api/tasks/:id` | Eliminar tarea |
| `GET` | `/api/health` | Estado del backend y de la conexión a base de datos |
| `GET` | `/api/instance` | Nombre de la instancia que atendió la petición |

## 8. Variables de entorno

Se definen en el archivo `.env` de la raíz (no versionado) a partir de `.env.example`:

| Variable | Usada por | Descripción |
|---|---|---|
| `DB_NAME` | postgres, backends | Nombre de la base de datos |
| `DB_USER` | postgres, backends | Usuario de la base de datos |
| `DB_PASSWORD` | postgres, backends | Contraseña del usuario |
| `DB_PORT` | backends | Puerto interno de PostgreSQL (5432) |
| `APP_PORT` | nginx-lb | Puerto publicado en el host (8080) |

Docker Compose inyecta además, de forma fija en el propio `docker-compose.yml`:

- `DB_HOST=postgres` en ambos backends.
- `INSTANCE_NAME=backend-1` y `INSTANCE_NAME=backend-2` en cada instancia.
- `POSTGRES_DB`, `POSTGRES_USER` y `POSTGRES_PASSWORD` en el servicio `postgres`, mapeadas desde las variables `DB_*`.

## 9. Persistencia

El directorio de datos de PostgreSQL (`/var/lib/postgresql/data`) se monta sobre el volumen con nombre `postgres-data`. El volumen sobrevive a `docker compose down` y a reinicios de contenedores. Solo se elimina con `docker compose down -v`, que no forma parte del flujo normal de trabajo.

## 10. Arranque ordenado y healthchecks

- `postgres` define un healthcheck con `pg_isready`.
- `backend-1` y `backend-2` esperan a que `postgres` esté sano (`condition: service_healthy`) y definen su propio healthcheck sobre `/api/health`.
- `nginx-lb` espera a que ambos backends y `frontend` hayan arrancado.

Con esto se evita que NestJS intente conectarse antes de que PostgreSQL acepte conexiones.

## 11. Estructura del repositorio

```
task-manager/
├── backend/               API NestJS (Dockerfile multi-stage propio)
│   ├── src/
│   │   ├── tasks/         Entidad, DTOs, servicio y controlador de tareas
│   │   ├── database/      Configuración de TypeORM
│   │   ├── health/        Endpoints /api/health y /api/instance
│   │   ├── app.module.ts
│   │   └── main.ts
│   └── test/
├── frontend/              SPA Vue 3 + Vite (Dockerfile multi-stage propio)
│   └── src/
│       ├── components/
│       ├── services/      Cliente HTTP hacia /api
│       └── views/
├── nginx/
│   └── nginx.conf         Reverse proxy y upstream de backends
├── scripts/
│   └── test-communication.sh
├── docs/                  Documentación técnica y evidencias
├── .github/workflows/
│   └── ci.yml             Pipeline de GitHub Actions
├── .env.example
├── .gitignore
├── docker-compose.yml
└── README.md
```

## 12. Decisiones técnicas

- **Construcción dentro de Docker.** Ni el backend ni el frontend dependen de un Node.js instalado en la máquina. Cada Dockerfile tiene una etapa `builder` que ejecuta `npm ci` y `npm run build`, y una etapa final que solo contiene lo necesario para ejecutar.
- **Una sola imagen para los dos backends.** Evita duplicar código y hace evidente que el balanceo es entre instancias idénticas.
- **Nginx como único punto publicado.** Reduce la superficie expuesta y obliga a que toda comunicación interna pase por la red de Docker.
- **Usuario no root en el backend.** La imagen oficial de Node incluye el usuario `node`; la etapa final se ejecuta con él.
- **Ruta relativa `/api` en el frontend.** La SPA funciona igual en local, en Docker o detrás de cualquier proxy sin recompilar.
- **Round-robin en el upstream.** Es el algoritmo por defecto de Nginx y reparte las peticiones de forma alterna entre `backend-1` y `backend-2`. Se probó también `least_conn`, pero con peticiones muy cortas tiende a concentrar la mayoría en la primera instancia, lo que hace menos evidente el balanceo en la demostración.
