package com.workbench.backendjava.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class KnowledgeDocumentContentUpdateRequest {
    @NotBlank(message = "内容不能为空")
    private String content;
}
