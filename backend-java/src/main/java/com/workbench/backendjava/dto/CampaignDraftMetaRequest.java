package com.workbench.backendjava.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

/** 活动帖 activityJson 扩展字段（配图选图、AI 方案等） */
@Data
public class CampaignDraftMetaRequest {

    private List<Map<String, Object>> postSchemes;

    private List<Long> selectedAssetIds;
}
