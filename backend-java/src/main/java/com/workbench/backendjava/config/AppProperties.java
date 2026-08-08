package com.workbench.backendjava.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "app")
public class AppProperties {

    /**
     * 对外访问根地址，用于拼完整 URL
     * 开发: http://localhost:8080
     * 生产: https://api.xxx.com
     */
    private String publicBaseUrl = "http://localhost:8080";
}
