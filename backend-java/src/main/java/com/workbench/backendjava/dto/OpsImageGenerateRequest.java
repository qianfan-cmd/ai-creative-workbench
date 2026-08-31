package com.workbench.backendjava.dto;

import lombok.Data;

@Data
public class OpsImageGenerateRequest {
    private String prompt;
    private String sourceUrl;
    private Integer count;
    private String aspectRatio;
}
