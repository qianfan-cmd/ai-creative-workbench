package com.workbench.backendjava.vo;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class KnowledgeDocumentVO {
    private Long id;
    private String filename;
    private String fileType;
    private Long fileSize;
    private Integer charCount;
    private Integer chunkCount;
    private String createdAt;
    private Boolean hasOriginalFile;
    private List<TagVO> tags = new ArrayList<>();
}
