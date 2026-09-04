package com.workbench.backendjava.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "app.mail")
public class MailProperties {

    /**
     * qq | 163 | gmail | custom — 当前仅用于启动日志与文档，发送仍走 spring.mail.*
     */
    private String provider = "qq";

    private String fromName = "AI Creative Workbench";
}
