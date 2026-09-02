package com.workbench.backendjava.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "app.storage")
public class StorageProperties {

    /** local | oss（future） */
    private String provider = "local";

    private Oss oss = new Oss();

    @Data
    public static class Oss {
        private boolean enabled = false;
        private String bucket = "";
        /** 未来 CDN / OSS 公网域名，如 https://cdn.example.com */
        private String publicBaseUrl = "";
    }
}
