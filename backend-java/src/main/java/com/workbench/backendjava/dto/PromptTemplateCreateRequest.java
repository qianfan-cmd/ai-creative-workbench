package com.workbench.backendjava.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class PromptTemplateCreateRequest {

    @NotBlank(message = "模板名称不能为空")
    private String name;

    /** 如 copy_style_playful、matting；与 list 查询的 scene 一致 */
    @NotBlank(message = "scene 不能为空")
    private String scene;

    @NotBlank(message = "模板内容不能为空")
    private String content;
}
