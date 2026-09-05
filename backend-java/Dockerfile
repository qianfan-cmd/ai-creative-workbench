# FROM maven:... AS build：第一阶段叫 build
  #COPY pom.xml + go-offline：依赖不变时，下次 build 会快很多
  #mvn clean package -DskipTests：打 jar，先跳过测试（CI 里可以再加 test）
  #COPY --from=build ...：只从 build 阶段拿 jar，不带 Maven
  #EXPOSE 8080：文档说明端口（Spring Boot 默认 8080）
  #ENTRYPOINT：容器启动时执行的命令
  #jar 名 backend-java-0.0.1-SNAPSHOT.jar 来自你 pom.xml 里的 artifactId + version。

# ========== 阶段 1：编译 ==========
FROM docker.m.daocloud.io/library/maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app

# 先只复制 pom，利用 Docker 缓存依赖层
COPY pom.xml .
RUN mvn dependency:go-offline -B

COPY src ./src
RUN mvn clean package -DskipTests -B

# ========== 阶段 2：运行 ==========
FROM docker.m.daocloud.io/library/eclipse-temurin:17-jre-alpine
WORKDIR /app

COPY --from=build /app/target/backend-java-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]