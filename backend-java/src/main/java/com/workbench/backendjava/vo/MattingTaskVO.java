package com.workbench.backendjava.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class MattingTaskVO {
    private Long id;
    private String title;
    private Integer stage;
    private String status;
    private Long sourceAssetId;
    private String sourceAssetUrl;
    private String configJson;
    private String selectedCandidate;
    private LocalDateTime updatedAt;
}
