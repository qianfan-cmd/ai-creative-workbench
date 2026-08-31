package com.workbench.backendjava.dto;

import lombok.Data;

import java.util.List;

@Data
public class CampaignImagesSaveRequest {
    private Long coverAssetId;
    private List<Long> imageAssetIds;
}
