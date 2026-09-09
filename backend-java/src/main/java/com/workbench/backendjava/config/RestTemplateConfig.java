package com.workbench.backendjava.config;

import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

/**
 * HTTP 客户端配置：提供 RestTemplate，供 PythonAiClient 调用 ai-service-python。
 */
@Configuration
public class RestTemplateConfig {

    /**
     * RestTemplate：Spring 自带的同步 HTTP 客户端（类似 Python httpx / 前端 axios）。
     *
     * RestTemplateBuilder：Spring Boot 提供的建造者，可链式设置超时等。
     * @Bean：方法返回值注册为 Spring 容器里的 Bean，别处可 @Autowired / 构造器注入。
     */
    @Bean
    @Primary
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        return builder
                .setConnectTimeout(Duration.ofSeconds(10))   // 建立连接最多等 10 秒，连不上时尽快报错
                .setReadTimeout(Duration.ofSeconds(300))     // 读响应最多等 300 秒（批量删除/多步调用 Python）
                .build();
    }

    /** RAG SSE：检索+rerank 首包可能较慢，readTimeout 加长避免 Read timed out */
    @Bean("ragStreamRestTemplate")
    public RestTemplate ragStreamRestTemplate(RestTemplateBuilder builder) {
        return builder
                .setConnectTimeout(Duration.ofSeconds(10))
                .setReadTimeout(Duration.ofSeconds(300))
                .build();
    }

    /** 文档入库：parse + chunk + embedding，大 PDF 或批量时可能较慢 */
    @Bean("documentIndexRestTemplate")
    public RestTemplate documentIndexRestTemplate(RestTemplateBuilder builder) {
        return builder
                .setConnectTimeout(Duration.ofSeconds(10))
                .setReadTimeout(Duration.ofSeconds(300))
                .build();
    }
}