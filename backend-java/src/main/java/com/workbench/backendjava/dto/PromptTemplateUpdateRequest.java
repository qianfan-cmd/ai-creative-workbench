package com.workbench.backendjava.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class PromptTemplateUpdateRequest {

    @NotBlank(message = "模板名称不能为空")
    private String name;

    @NotBlank(message = "scene 不能为空")
    private String scene;

    @NotBlank(message = "模板内容不能为空")
    private String content;
}