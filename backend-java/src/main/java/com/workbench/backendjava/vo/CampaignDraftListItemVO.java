package com.workbench.backendjava.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class CampaignDraftListItemVO {

    private Long id;

    private String title;

    private Boolean pinned;

    private String status;

    private String coverUrl;

    private LocalDateTime updatedAt;
}
