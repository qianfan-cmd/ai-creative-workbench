package com.workbench.backendjava.dto;

import lombok.Data;

@Data
public class MattingGenerateRequest {
    private String prompt;
    private Integer count = 4;
}
