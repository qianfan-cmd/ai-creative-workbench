package com.workbench.backendjava.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class RagSourceSignalClearRequest {

    @NotBlank
    private String source;

    /** penalty | boost | all */
    @NotBlank
    @Pattern(regexp = "penalty|boost|all", message = "field 无效")
    private String field;
}
