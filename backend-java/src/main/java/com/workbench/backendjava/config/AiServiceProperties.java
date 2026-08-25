package com.workbench.backendjava.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "app.ai-service")
public class AiServiceProperties {

    private String baseUrl = "http://localhost:8000";
}
