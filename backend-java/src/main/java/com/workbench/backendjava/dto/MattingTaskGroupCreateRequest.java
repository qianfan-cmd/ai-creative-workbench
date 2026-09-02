package com.workbench.backendjava.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class MattingTaskGroupCreateRequest {

    @NotBlank
    @Size(max = 20)
    private String name;
}
