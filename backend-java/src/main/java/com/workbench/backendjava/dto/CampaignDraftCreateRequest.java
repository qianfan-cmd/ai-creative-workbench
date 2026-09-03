package com.workbench.backendjava.dto;

import lombok.Data;

@Data
public class CampaignDraftCreateRequest {

    /** 可为空；空时草稿标题默认为「活动帖」 */
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