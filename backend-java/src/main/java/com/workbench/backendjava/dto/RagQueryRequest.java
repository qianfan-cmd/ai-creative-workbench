package com.workbench.backendjava.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class RagQueryRequest {

    @NotBlank(message = "问题不能为空")
    private String question;

    /**
     * 检索条数
     */
    @Min(1)
    @Max(10)
    private Integer topK = 3;
}
