package com.workbench.backendjava.vo;

import lombok.Data;

@Data
public class MattingConfirmedSourceVO {
    private String id;
    private String schemeId;
    private Long sourceAssetId;
    private String sourceAssetUrl;
    private String label;
    private Integer sortOrder;
}
