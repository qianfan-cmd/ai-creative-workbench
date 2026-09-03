package com.workbench.backendjava.dto;

import lombok.Data;

@Data
public class CampaignDraftPatchRequest {

    private String title;

    private Boolean pinned;
}
