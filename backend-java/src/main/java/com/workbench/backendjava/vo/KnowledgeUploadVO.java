package com.workbench.backendjava.vo;

import lombok.Data;

/**
 * 知识库文档上传/入库结果 — 对应 Python DocumentIndexResponse。
 */
@Data
public class KnowledgeUploadVO {
    private String filename;
    private Integer charCount;
    private Integer chunkCount;
    private Integer indexedCount;
}