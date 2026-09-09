package com.workbench.backendjava.vo;

import lombok.Data;

@Data
public class KnowledgeReindexFailureVO {
    private Long id;
    private String filename;
    private String reason;
}
