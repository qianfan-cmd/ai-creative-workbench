package com.workbench.backendjava.vo;

import lombok.Data;

/**
 * 知识库文档库左栏单项 — 对应 Python DocumentListItem。
 */
@Data
public class KnowledgeDocumentVO {
    private String filename;
    private Integer chunkCount;
}
