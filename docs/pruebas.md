# Procedimiento de pruebas

Este documento describe cómo comprobar la comunicación entre contenedores, la persistencia de datos y el balanceo de carga de Task Manager. Cada paso incluye el comando a ejecutar y el resultado esperado. Al final se registran los resultados obtenidos en la ejecución de referencia.

Todos los comandos se ejecutan desde la raíz del repositorio, con un archivo `.env` creado a partir de `.env.example`. En Windows se recomienda Git Bash.

## 1. Construir las imágenes

```bash
docker compose build
```

Resultado esperado: se construyen `taskmanager-backend` y `taskmanager-frontend`. En la salida debe verse `npm ci` y `npm run build` ejecutándose dentro de la etapa `builder` de cada Dockerfile.

## 2. Levantar los contenedores

```bash
docker compose up -d
```

Resultado esperado: Compose arranca `postgres`, espera a que esté sano, arranca `backend-1`, `backend-2` y `frontend`, espera a que estén sanos y por último arranca `nginx-lb`.

## 3. Verificar que todos estén activos

```bash
docker compose ps
```

Resultado esperado: cinco contenedores con estado `Up ... (healthy)`. Solo `nginx-lb` muestra un puerto publicado (`0.0.0.0:8080->80/tcp`).

```bash
docker network inspect taskmanager-network
```

Resultado esperado: driver `bridge` y los cinco contenedores listados en `Containers`, cada uno con su IP interna.

## 4. Crear una tarea mediante HTTP

```bash
curl -i -X POST http://localhost:8080/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Tarea de prueba","description":"Creada por HTTP a traves de Nginx"}'
```

Resultado esperado: `HTTP/1.1 201 Created`, cabecera `X-Backend-Instance` con `backend-1` o `backend-2`, y un JSON con `id` (UUID), `status: "PENDING"`, `createdAt` y `updatedAt`. Anota el `id`.

## 5. Confirmar que NestJS guardó la tarea en PostgreSQL

```bash
docker compose exec postgres psql -U taskmanager_user -d taskmanager \
  -c 'SELECT id, title, status, "createdAt" FROM tasks;'
```

Resultado esperado: una fila con el mismo `id` que devolvió la API. Esto demuestra que el dato no está en memoria del backend sino en la base de datos.

## 6. Consultar nuevamente las tareas

```bash
curl http://localhost:8080/api/tasks
curl http://localhost:8080/api/tasks/<id>
```

Resultado esperado: la tarea creada aparece en el listado y se puede consultar por id.

## 7. Verificar la comunicación mediante el hostname `postgres`

```bash
docker compose exec backend-1 sh -c 'echo DB_HOST=$DB_HOST; getent hosts postgres'
```

Resultado esperado: `DB_HOST=postgres` y una línea con la IP interna que el DNS de Docker asigna al nombre `postgres`.

```bash
docker compose exec postgres psql -U taskmanager_user -d taskmanager \
  -c "SELECT client_addr, count(*) FROM pg_stat_activity WHERE client_addr IS NOT NULL GROUP BY client_addr;"
```

Resultado esperado: conexiones cuyo `client_addr` coincide con las IPs de `backend-1` y `backend-2` dentro de la red (ver `docker network inspect`).

## 8. Reiniciar el backend y comprobar que la información permanece

```bash
docker compose restart backend-1 backend-2
curl http://localhost:8080/api/tasks/<id>
```

Resultado esperado: la tarea sigue disponible. Los backends no guardan estado; todo está en PostgreSQL.

## 9. Reiniciar PostgreSQL y comprobar la persistencia del volumen

```bash
docker compose restart postgres
curl http://localhost:8080/api/tasks/<id>
curl http://localhost:8080/api/health
```

Resultado esperado: la tarea sigue disponible y `/api/health` devuelve `"database":"up"`. Los datos sobreviven porque el directorio de datos de PostgreSQL está en el volumen `postgres-data`.

```bash
docker volume inspect postgres-data
```

## 10. Prueba de balanceo de carga

```bash
for i in $(seq 1 10); do curl -s http://localhost:8080/api/instance; echo; done
```

Resultado esperado: las respuestas alternan entre `{"instance":"backend-1",...}` y `{"instance":"backend-2",...}`, con hostnames distintos (son los IDs de cada contenedor).

```bash
docker compose logs nginx-lb | grep /api/instance
```

Resultado esperado: el campo `upstream=` de cada línea alterna entre las IPs internas de `backend-1` y `backend-2`.

## 11. Script automático

```bash
bash scripts/test-communication.sh
```

El script ejecuta los pasos 4, 6 y 10 y verifica el estado de salud. Devuelve `0` si todo pasa y `1` si alguna comprobación falla.

## 12. Validación de la interfaz

Abrir `http://localhost:8080` en el navegador:

- Crear una tarea desde el formulario y verificar que aparece en la lista.
- Marcar la tarea como completada y verificar el cambio de estado.
- Editar y eliminar la tarea.
- Observar el indicador superior derecho, que muestra qué instancia respondió a la última operación.

## 13. Resultados de la ejecución de referencia

Ejecución realizada el 4 de noviembre de 2026 en Windows 11 con Docker 29.9.2 y Docker Compose v5.6.1.

### Estado de los contenedores

```
NAME                    STATUS                   PORTS
taskmanager-backend-1   Up (healthy)             3000/tcp
taskmanager-backend-2   Up (healthy)             3000/tcp
taskmanager-frontend    Up (healthy)             80/tcp
taskmanager-nginx-lb    Up (healthy)             0.0.0.0:8080->80/tcp
taskmanager-postgres    Up (healthy)             5432/tcp
```

### Red

```
taskmanager-network driver=bridge
  taskmanager-postgres  = 192.168.16.2/20
  taskmanager-frontend  = 192.168.16.3/20
  taskmanager-backend-2 = 192.168.16.4/20
  taskmanager-backend-1 = 192.168.16.5/20
  taskmanager-nginx-lb  = 192.168.16.6/20
```

### Salud y creación de tarea

```
GET /api/health
HTTP/1.1 200 OK
X-Backend-Instance: backend-1
{"status":"ok","database":"up","instance":"backend-1","timestamp":"2026-11-04T17:03:16.054Z"}

POST /api/tasks
{"id":"d3f15c08-f109-4de0-8e57-99a6440d844c","title":"...","status":"PENDING",
 "createdAt":"2026-11-04T17:03:16.342Z","updatedAt":"2026-11-04T17:03:16.342Z"}
```

### Fila en PostgreSQL

```
                  id                  | status  |         createdAt
--------------------------------------+---------+----------------------------
 d3f15c08-f109-4de0-8e57-99a6440d844c | PENDING | 2026-11-04 17:03:16.342877
(1 row)
```

### Resolución del hostname `postgres` desde el backend

```
DB_HOST=postgres
192.168.16.2      postgres  postgres
```

### Conexiones vistas por PostgreSQL

```
 client_addr  | count
--------------+-------
 192.168.16.5 |     1      <- IP de backend-1
```

### Persistencia

- Tras `docker compose restart backend-1 backend-2`: la tarea `d3f15c08-...` siguió respondiendo en `GET /api/tasks/:id`.
- Tras `docker compose restart postgres`: la tarea siguió disponible y `/api/health` devolvió `"database":"up"`.

### Balanceo

Salida de `scripts/test-communication.sh`:

```
== 4. Balanceo de carga (10 peticiones a /api/instance) ==
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

Resultado: todas las comprobaciones pasaron.
```

Logs de Nginx para esas peticiones:

```
"GET /api/instance HTTP/1.1" 200 upstream=192.168.16.5:3000
"GET /api/instance HTTP/1.1" 200 upstream=192.168.16.4:3000
"GET /api/instance HTTP/1.1" 200 upstream=192.168.16.5:3000
"GET /api/instance HTTP/1.1" 200 upstream=192.168.16.4:3000
```

### Pruebas automatizadas del backend (dentro de Docker)

```
npm test       -> 3 archivos, 17 pruebas, todas en verde
npm run test:e2e -> 1 archivo, 2 pruebas, todas en verde
npm run lint   -> 0 errores
```

### Pendiente

- Ejecución del pipeline de GitHub Actions: se registra una vez el repositorio reciba el primer push.
