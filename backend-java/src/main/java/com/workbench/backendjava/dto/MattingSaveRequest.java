package com.workbench.backendjava.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class MattingSaveRequest {
    @NotBlank
    private String candidateUrl;
    private String name;
}
