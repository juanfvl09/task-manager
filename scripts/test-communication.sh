#!/usr/bin/env bash
#
# Prueba de comunicación entre contenedores de Task Manager.
#
# Comprueba, a través de Nginx:
#   1. que la API responde y tiene conexión con PostgreSQL,
#   2. que una tarea creada por HTTP se guarda y se puede consultar,
#   3. que las dos instancias del backend atienden peticiones.
#
# Uso: scripts/test-communication.sh [URL_BASE]
#   URL_BASE por defecto: http://localhost:8080

set -euo pipefail

BASE_URL="${1:-http://localhost:8080}"
API="$BASE_URL/api"
INTENTOS_ESPERA=30
PETICIONES_BALANCEO=10

errores=0

ok()    { printf '  [OK]    %s\n' "$1"; }
fallo() { printf '  [ERROR] %s\n' "$1"; errores=$((errores + 1)); }
titulo(){ printf '\n== %s ==\n' "$1"; }

extraer_id() {
  sed -E 's/.*"id":"([0-9a-f-]{36})".*/\1/'
}

# 1. Disponibilidad de la API ------------------------------------------------
titulo "1. Disponibilidad de la API"
disponible=0
for ((i = 1; i <= INTENTOS_ESPERA; i++)); do
  if salud=$(curl -sf "$API/health" 2>/dev/null); then
    disponible=1
    break
  fi
  printf '  esperando a la API (%d/%d)...\n' "$i" "$INTENTOS_ESPERA"
  sleep 2
done

if [[ $disponible -eq 1 ]]; then
  ok "GET /api/health -> $salud"
  if [[ "$salud" == *'"database":"up"'* ]]; then
    ok "El backend reporta conexión con PostgreSQL"
  else
    fallo "El backend no reporta la base de datos como disponible"
  fi
else
  fallo "La API no respondió en $API/health"
  printf '\nResultado: %d error(es). Revisa "docker compose ps" y "docker compose logs".\n' "$errores"
  exit 1
fi

# 2. Creación de una tarea ---------------------------------------------------
titulo "2. Creación de una tarea"
marca=$(date +%s)
cuerpo="{\"title\":\"Prueba de comunicacion $marca\",\"description\":\"Creada por scripts/test-communication.sh\"}"

if respuesta=$(curl -sf -X POST "$API/tasks" -H 'Content-Type: application/json' -d "$cuerpo"); then
  id=$(printf '%s' "$respuesta" | extraer_id)
  if [[ ${#id} -eq 36 ]]; then
    ok "POST /api/tasks -> id $id"
  else
    fallo "La respuesta de creación no contiene un id válido: $respuesta"
    id=""
  fi
else
  fallo "POST /api/tasks falló"
  id=""
fi

# 3. Consulta de la tarea ----------------------------------------------------
titulo "3. Consulta de la tarea"
if [[ -n "$id" ]]; then
  if detalle=$(curl -sf "$API/tasks/$id"); then
    if [[ "$detalle" == *"Prueba de comunicacion $marca"* ]]; then
      ok "GET /api/tasks/$id devuelve la tarea creada"
    else
      fallo "GET /api/tasks/$id devolvió un contenido inesperado: $detalle"
    fi
  else
    fallo "GET /api/tasks/$id falló"
  fi

  if listado=$(curl -sf "$API/tasks") && [[ "$listado" == *"$id"* ]]; then
    ok "GET /api/tasks incluye la tarea creada"
  else
    fallo "GET /api/tasks no incluye la tarea creada"
  fi
else
  fallo "Se omite la consulta porque no se obtuvo un id"
fi

# 4. Balanceo entre instancias ----------------------------------------------
titulo "4. Balanceo de carga ($PETICIONES_BALANCEO peticiones a /api/instance)"
instancias=""
for ((i = 1; i <= PETICIONES_BALANCEO; i++)); do
  if r=$(curl -sf "$API/instance"); then
    nombre=$(printf '%s' "$r" | sed -E 's/.*"instance":"([^"]+)".*/\1/')
    instancias+="$nombre"$'\n'
    printf '  petición %2d -> %s\n' "$i" "$nombre"
  else
    fallo "La petición $i a /api/instance falló"
  fi
done

distintas=$(printf '%s' "$instancias" | sort -u | grep -c .)
if [[ $distintas -ge 2 ]]; then
  ok "Respondieron $distintas instancias distintas:"
  printf '%s' "$instancias" | sort | uniq -c | sed 's/^/        /'
else
  fallo "Solo respondió $distintas instancia(s); no se evidencia balanceo"
fi

# 5. Limpieza ----------------------------------------------------------------
titulo "5. Limpieza"
if [[ -n "$id" ]]; then
  if [[ "${KEEP_TASK:-0}" == "1" ]]; then
    ok "Se conserva la tarea $id (KEEP_TASK=1)"
  elif curl -sf -X DELETE "$API/tasks/$id" >/dev/null; then
    ok "Tarea de prueba eliminada"
  else
    fallo "No se pudo eliminar la tarea de prueba $id"
  fi
fi

# Resultado ------------------------------------------------------------------
printf '\n'
if [[ $errores -eq 0 ]]; then
  printf 'Resultado: todas las comprobaciones pasaron.\n'
  exit 0
else
  printf 'Resultado: %d error(es).\n' "$errores"
  exit 1
fi
