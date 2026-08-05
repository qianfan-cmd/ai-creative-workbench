package com.workbench.backendjava.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;

@Data
@Component
@ConfigurationProperties(prefix = "app.upload")
public class UploadProperties {
    private String dir = "./uploads";
    private long maxSize = 52_428_800L;
    private List<String> allowedExtensions = List.of("png", "jpg", "jpeg", "gif", "webp","pdf");
}
