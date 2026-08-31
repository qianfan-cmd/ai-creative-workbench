package com.workbench.backendjava.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CampaignCopySaveRequest {

    @NotBlank(message = "标题不能为空")
    private String copyTitle;

    @NotBlank(message = "正文不能为空")
    private String copyBody;
}