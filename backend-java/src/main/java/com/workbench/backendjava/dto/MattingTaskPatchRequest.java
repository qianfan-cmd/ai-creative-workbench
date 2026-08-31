package com.workbench.backendjava.dto;

import lombok.Data;

@Data
public class MattingTaskPatchRequest {
    private String title;
    private Integer stage;
    private Long sourceAssetId;
    private String configJson;
    private String selectedCandidate;
    private String status;
}
