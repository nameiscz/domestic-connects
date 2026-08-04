# syntax=docker/dockerfile:1

# ---- Build stage: compile the module with Maven ----
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY . .
RUN mvn -q -pl config-server -am package -Dmaven.test.skip=true

# ---- Runtime stage ----
# The config repository (config-server/config-repo) is mounted read-only at
# runtime; see docker-compose.yml (SPRING_CLOUD_CONFIG_SERVER_NATIVE_SEARCH_LOCATIONS).
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /workspace/config-server/target/*.jar app.jar
EXPOSE 8888
ENTRYPOINT ["java", "-jar", "app.jar"]
