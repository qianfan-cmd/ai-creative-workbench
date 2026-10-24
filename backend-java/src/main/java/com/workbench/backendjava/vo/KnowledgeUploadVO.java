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
    private java.util.List<String> suggestedTags = new java.util.ArrayList<>();

    /** 文档主键，列表/轮询用 */
    private Long documentId;

    /** async_job.id；index 完成后前端可 GET /knowledge/jobs/{id} */
    private Long jobId;

    /**
     * 索引状态：异步上传时为 pending_index；同步模式 index 成功后仍为 ready（见 KnowledgeIndexStatus）
     */
    private String indexStatus;
}