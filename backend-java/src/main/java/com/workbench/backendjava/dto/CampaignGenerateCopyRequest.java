package com.workbench.backendjava.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CampaignGenerateCopyRequest {

    /** draft=初稿 | refine=风格优化 */
    @NotBlank(message = "mode 不能为空")
    private String mode;

    /** mode=refine 时必填，对应 prompt_template.id */
    private Long styleTemplateId;

    /** 优化时的补充说明，可选 */
    private String hint;
}