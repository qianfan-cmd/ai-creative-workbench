package com.workbench.backendjava.vo;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
public class MattingTaskVO {
    private Long id;
    private String title;
    private Integer stage;
    private String status;
    private Long sourceAssetId;
    private String sourceAssetUrl;
    private List<MattingConfirmedSourceVO> confirmedSources = new ArrayList<>();
    private String configJson;
    private String selectedCandidate;
    private LocalDateTime updatedAt;
}
