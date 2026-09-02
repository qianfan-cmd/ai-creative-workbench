package com.workbench.backendjava.dto;

import lombok.Data;

@Data
public class KnowledgeSessionPatchRequest {
    private String title;
    private Boolean pinned;
}
