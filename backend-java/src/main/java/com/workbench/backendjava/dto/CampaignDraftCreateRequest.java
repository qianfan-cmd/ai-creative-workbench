package com.workbench.backendjava.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CampaignDraftCreateRequest {

    @NotBlank(message = "活动主题不能为空")
    private String theme;

    /** 如 "2026-08-15 ~ 2026-08-31"，前端 DateRange 格式化后传入 */
    private String timeRange;

    /**
     * 受众
     */
    private String audience;

    private String benefits;

    /**
     * 视觉样式
     */
    private String visualStyle;

    private String aspectRatio;

    private String forbiddenWords;
}