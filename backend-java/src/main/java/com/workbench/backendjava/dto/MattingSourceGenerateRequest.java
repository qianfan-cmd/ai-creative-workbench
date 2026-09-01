package com.workbench.backendjava.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class MattingSourceGenerateRequest {
    @NotBlank
    private String prompt;
    @Min(1)
    @Max(6)
    private Integer count = 4;
    private String aspectRatio;
    private List<String> referenceUrls;
}
