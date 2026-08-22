FROM maven:3.9-eclipse-temurin-25 AS build
ENV MAVEN_CONFIG=""
WORKDIR /app
COPY pom.xml .
COPY .mvn/ .mvn/
COPY mvnw .
RUN ./mvnw -q -B dependency:go-offline || true
COPY src/ src/
RUN ./mvnw -q -B -DskipTests package

FROM eclipse-temurin:25-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=5s --retries=12 CMD wget --quiet --output-document=/dev/null http://127.0.0.1:8080/actuator/health || exit 1
ENTRYPOINT ["java", "-jar", "app.jar"]
