// Pipeline de Task Manager: toma el código de GitHub, construye las imágenes,
// corre las pruebas y, si todo pasa en main, despliega la aplicación en esta máquina.
pipeline {
  agent any

  options {
    buildDiscarder(logRotator(numToKeepStr: '15'))
    timeout(time: 30, unit: 'MINUTES')
    disableConcurrentBuilds()
    timestamps()
  }

  triggers {
    // Revisa GitHub cada dos minutos; con un push nuevo el build arranca solo
    pollSCM('H/2 * * * *')
  }

  environment {
    // Entorno de pruebas aislado: otro nombre de proyecto y otro puerto
    CI_PROJECT = 'taskmanager-ci'
    CI_PORT = '8081'
    COMPOSE_CI = 'docker compose -p taskmanager-ci -f docker-compose.yml -f docker-compose.ci.yml'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        sh 'git log -1 --format="Commit %h: %s (%an, %ci)"'
      }
    }

    stage('Build') {
      steps {
        // El .env real vive como credencial en Jenkins, nunca en el repositorio
        withCredentials([file(credentialsId: 'taskmanager-env', variable: 'ENV_FILE')]) {
          sh 'cp "$ENV_FILE" .env'
        }
        sh 'docker compose build --pull backend-1 frontend nginx-lb'
        sh 'docker image ls --format "{{.Repository}}:{{.Tag}}  {{.Size}}" | grep taskmanager-'
      }
    }

    stage('Test') {
      stages {
        stage('Pruebas unitarias') {
          steps {
            sh '''
              mkdir -p reportes
              docker build --target builder -t taskmanager-backend-builder ./backend
              docker rm -f tm-pruebas >/dev/null 2>&1 || true
              set +e
              docker run --name tm-pruebas taskmanager-backend-builder \
                npx vitest run --reporter=default --reporter=junit --outputFile=reportes/unitarias.xml
              estado=$?
              docker cp tm-pruebas:/app/reportes/unitarias.xml reportes/ || true
              docker rm -f tm-pruebas >/dev/null
              exit $estado
            '''
          }
        }
        stage('Comunicación entre contenedores') {
          steps {
            sh '''
              $COMPOSE_CI up -d --wait --wait-timeout 180
              $COMPOSE_CI ps
            '''
            // Nginx -> backend-1/backend-2 -> postgres, todo por nombre de servicio
            sh 'bash scripts/test-communication.sh http://host.docker.internal:$CI_PORT'
          }
          post {
            always {
              sh '$COMPOSE_CI logs --tail=20 backend-1 backend-2 postgres || true'
              sh '$COMPOSE_CI down -v --remove-orphans || true'
            }
          }
        }
      }
    }

    stage('Deploy') {
      // Solo despliega lo que llega a main (el checkout deja la rama en GIT_BRANCH como origin/main)
      when { expression { (env.GIT_BRANCH ?: '').endsWith('/main') } }
      steps {
        // Las imágenes ya están construidas y probadas; se recrean solo los contenedores que cambiaron
        sh 'docker compose up -d --no-build --wait --wait-timeout 180'
        sh 'docker compose ps'
      }
    }
  }

  post {
    always {
      junit testResults: 'reportes/*.xml', allowEmptyResults: true
      sh 'rm -f .env'
    }
    success {
      echo "Build ${env.BUILD_NUMBER} OK: Task Manager disponible en http://localhost:8080"
    }
    failure {
      echo "Build ${env.BUILD_NUMBER} fallido: revisa la etapa en rojo antes de volver a hacer push"
    }
  }
}
