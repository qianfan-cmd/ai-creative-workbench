package com.workbench.backendjava.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class MattingTaskCreateRequest {
    @NotBlank
    private String title;
}
