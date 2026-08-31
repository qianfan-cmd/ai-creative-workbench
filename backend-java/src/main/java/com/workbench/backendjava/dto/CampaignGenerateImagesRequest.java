package com.workbench.backendjava.dto;

import lombok.Data;

@Data
public class CampaignGenerateImagesRequest {
    /** 可选参考图源 asset id */
    private Long sourceAssetId;
    private String promptOverride;
    private Integer count = 4;
}
