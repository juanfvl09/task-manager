# Integración continua con Jenkins

Esta parte corresponde a la Entrega 2. Jenkins toma el código del repositorio en GitHub, construye las imágenes de los servicios de la Entrega 1, ejecuta las pruebas y, si todo pasa en `main`, deja la aplicación desplegada en la misma máquina.

## Flujo

```
commit --> push a GitHub --> Jenkins (Poll SCM cada 2 min) --> Checkout --> Build --> Test --> Deploy
                                                                      |         |        |
                                                                      |         |        +-- pruebas unitarias (vitest en contenedor)
                                                                      |         |        +-- stack de prueba en 8081 + scripts/test-communication.sh
                                                                      |         +-- docker compose build (backend, frontend, nginx-lb)
                                                                      +-- git clone de main
```

Si una prueba falla, el build queda en rojo y no se llega a `Deploy`.

## Requisitos

Hardware mínimo para correr Jenkins junto con el stack de Task Manager:

| Recurso | Mínimo | Observación |
|---|---|---|
| CPU | 2 núcleos | El build del backend y el frontend compila TypeScript dentro de Docker |
| RAM | 4 GB libres | Jenkins usa alrededor de 1 GB; el stack de prueba con cinco contenedores, otro tanto |
| Disco | 5 GB libres | Imágenes de Node, Nginx, PostgreSQL y Jenkins más el volumen `jenkins-home` |

Software:

- Docker Desktop (Windows con WSL2) o Docker Engine en Linux. Se usó Docker 29 con Compose v5.
- Git.
- Un repositorio en GitHub con el proyecto. Aquí: https://github.com/juanfvl09/task-manager

No hace falta Java ni Node.js en la máquina: todo corre en contenedores.

## Instalación

Jenkins corre como un contenedor construido a partir de `jenkins/jenkins:lts-jdk21`. Elegí esta opción en vez de instalarlo en Windows por tres razones: la versión queda fija y reproducible, la configuración está en archivos del repositorio y el servidor se puede borrar y volver a crear en minutos sin perder nada, porque los datos viven en el volumen `jenkins-home`.

La carpeta `jenkins/` tiene todo lo necesario:

| Archivo | Para qué sirve |
|---|---|
| `Dockerfile` | Parte de la imagen oficial, le copia el cliente de Docker desde `docker:cli` e instala los plugins de `plugins.txt` |
| `docker-compose.yml` | Publica el puerto 8090, monta el volumen, el socket de Docker y el `.env` de la aplicación |
| `jenkins.yaml` | Configuración como código (JCasC): usuario, seguridad, mensaje y la credencial `taskmanager-env` |
| `plugins.txt` | Lista de plugins que se instalan al construir la imagen |
| `.env.example` | Plantilla para el usuario y la clave del administrador de Jenkins |
| `exportar-ca.ps1` | Exporta desde Windows la CA de un proxy o firewall que inspeccione HTTPS (solo si la red lo necesita) |
| `certs/` | Donde quedan esas CA; no se suben al repositorio |

Pasos:

```bash
cd jenkins
cp .env.example .env        # cambiar JENKINS_ADMIN_PASSWORD
docker compose up -d --build
docker logs -f taskmanager-jenkins   # esperar "Jenkins is fully up and running"
```

Luego abrir http://localhost:8090 y entrar con el usuario y la clave del `.env`. No aparece el asistente de instalación: JCasC deja el servidor listo.

Si la construcción falla al descargar los plugins con `PKIX path building failed`, la red inspecciona el tráfico HTTPS. En ese caso, antes del `docker compose up`, ejecutar `powershell -ExecutionPolicy Bypass -File .\exportar-ca.ps1` para que la imagen confíe en la CA de la red.

## Puertos

| Puerto | Uso |
|---|---|
| 8090 | Interfaz web de Jenkins (dentro del contenedor es el 8080) |
| 8080 | Task Manager desplegado por el pipeline (`nginx-lb`) |
| 8081 | Stack temporal de pruebas que el pipeline levanta y destruye en cada build |

El puerto 50000 de agentes no se publica porque los builds corren en el propio controlador.

## Cómo llega Jenkins a Docker

El `docker-compose.yml` monta `/var/run/docker.sock` dentro del contenedor. Jenkins usa el Docker de la máquina (no un Docker dentro de otro), así que las imágenes que construye y los contenedores que levanta son los mismos que se ven con `docker ps` en el host. Por eso el despliegue del pipeline queda en esta misma máquina.

Esto tiene un costo en seguridad: quien controle Jenkins controla el Docker del host. Es aceptable para este proyecto, que corre en un equipo personal, pero en un servidor compartido habría que usar agentes separados.

Como consecuencia de este esquema, el servicio `nginx-lb` dejó de montar `nginx.conf` como volumen y ahora se construye como imagen (`nginx/Dockerfile`). Un bind mount desde el workspace de Jenkins apuntaría a una ruta que el Docker del host no puede ver.

## Plugins

| Plugin | Para qué se usa |
|---|---|
| `git`, `github` | Clonar el repositorio y consultar cambios (Poll SCM) |
| `workflow-aggregator` | Pipeline declarativo (`Jenkinsfile`) |
| `docker-workflow` | Integración de Docker con Pipeline |
| `credentials-binding`, `plain-credentials` | Usar credenciales de tipo archivo con `withCredentials` |
| `junit` | Publicar el reporte de vitest y mostrar la tendencia de pruebas |
| `timestamper` | Hora en cada línea de la consola |
| `configuration-as-code` | Configurar Jenkins desde `jenkins.yaml` |
| `pipeline-graph-view` | Vista gráfica de las etapas |

## Credenciales

La única información sensible del proyecto es la clave de PostgreSQL, que está en el `.env` de la raíz (ignorado por git). Ese archivo entra a Jenkins como una credencial de tipo **Secret file** con id `taskmanager-env`: el compose lo monta en `/run/secrets/taskmanager.env` y `jenkins.yaml` lo registra en el almacén de credenciales al arrancar. El `Jenkinsfile` lo pide con `withCredentials` solo durante el build y lo borra al final. En el código no hay ninguna clave.

El repositorio es público, así que para clonar no se necesita credencial de GitHub.

## El pipeline

El `Jenkinsfile` está en la raíz del repositorio y tiene estas etapas:

1. **Checkout**: clona `main` y muestra el commit que se va a construir.
2. **Build**: copia el `.env` desde la credencial y ejecuta `docker compose build` para `backend-1`, `frontend` y `nginx-lb`. Las dos instancias del backend usan la misma imagen, así que se construye una vez.
3. **Test**, en dos pasos:
   - **Pruebas unitarias**: construye la etapa `builder` del backend y corre vitest dentro de un contenedor desechable. El reporte JUnit se copia al workspace y Jenkins lo publica.
   - **Comunicación entre contenedores**: levanta el stack completo con `docker-compose.ci.yml` (proyecto `taskmanager-ci`, puerto 8081), espera a que los cinco servicios estén sanos y corre `scripts/test-communication.sh`. Ese script crea una tarea por HTTP, la lee desde PostgreSQL y comprueba que las dos instancias del backend responden detrás de Nginx. Al terminar, el stack de prueba se destruye, pase o falle.
4. **Deploy**, solo en `main`: `docker compose up -d` con las imágenes recién construidas. La aplicación queda en http://localhost:8080.

El bloque `post` publica el reporte de pruebas, borra el `.env` del workspace y deja un mensaje según el resultado.

## Disparo automático

El `Jenkinsfile` declara `pollSCM('H/2 * * * *')`. Jenkins consulta GitHub cada dos minutos y, si hay un commit nuevo en `main`, arranca el build solo. Preferí Poll SCM sobre el webhook porque la máquina no es accesible desde internet; un webhook necesitaría un túnel. Para un proyecto de este tamaño la diferencia de dos minutos no importa.

## Job

El job se llama `task-manager`, es de tipo Pipeline y toma el `Jenkinsfile` del repositorio:

- Definition: Pipeline script from SCM
- SCM: Git, URL `https://github.com/juanfvl09/task-manager.git`, rama `*/main`
- Script Path: `Jenkinsfile`

La primera ejecución se lanza a mano para que Jenkins lea el `Jenkinsfile` y registre el trigger; desde ahí, cada push lo dispara.
