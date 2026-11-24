# Jenkins LTS (Java 21) con el cliente de Docker y los plugins que usa el pipeline de Task Manager
FROM jenkins/jenkins:lts-jdk21
USER root
# Cliente Docker y sus plugins buildx y compose, copiados desde la imagen oficial docker:cli
COPY --from=docker:cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker:cli /usr/local/libexec/docker/cli-plugins/docker-buildx /usr/local/libexec/docker/cli-plugins/docker-buildx
COPY --from=docker:cli /usr/local/libexec/docker/cli-plugins/docker-compose /usr/local/libexec/docker/cli-plugins/docker-compose
# Si la red inspecciona HTTPS, sus CA raíz (certs/*.crt) van al sistema y a Java; sin .crt no pasa nada
COPY certs/ /tmp/certs/
RUN cp /tmp/certs/*.crt /usr/local/share/ca-certificates/ 2>/dev/null || true; \
    update-ca-certificates \
    && for f in /usr/local/share/ca-certificates/*.crt; do \
         [ -f "$f" ] || continue; \
         keytool -importcert -noprompt -cacerts -storepass changeit -alias "$(basename "$f" .crt)" -file "$f"; \
       done \
    && mkdir -p /usr/share/jenkins/ref/certs \
    && cp /etc/ssl/certs/ca-certificates.crt /usr/share/jenkins/ref/certs/ca-bundle.crt.override \
    && chown -R jenkins:jenkins /usr/share/jenkins/ref/certs \
    && rm -rf /tmp/certs
USER jenkins
COPY plugins.txt /usr/share/jenkins/ref/plugins.txt
# Algunas redes no enrutan IPv6 y Java lo intenta primero ("Network is unreachable")
RUN JAVA_TOOL_OPTIONS=-Djava.net.preferIPv4Stack=true jenkins-plugin-cli --plugin-file /usr/share/jenkins/ref/plugins.txt
COPY jenkins.yaml /usr/share/jenkins/ref/casc/jenkins.yaml
# El checkout lo hace el usuario jenkins sobre carpetas que pueden ser de otro dueño
RUN git config --global --add safe.directory '*'
ENV CASC_JENKINS_CONFIG=/var/jenkins_home/casc/jenkins.yaml
