package com.workbench.backendjava.vo;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
public class CampaignDraftVO {

    private Long id;

    private String title;

    /** 解析后的 activity_json，前端表单回显用 */
    private Map<String, Object> activity;

    private String copyTitle;

    private String copyBody;

    private String status;

    private Long coverAssetId;

    private String coverUrl;

    private List<Long> imageAssetIds;

    private LocalDateTime updatedAt;
}