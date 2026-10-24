package com.workbench.backendjava.common;

/**
 * knowledge_document.index_status 取值（Wave E-B3）。
 * 与 async_job.status 不同：这里是「文档是否可检索」的产品状态。
 */
public final class KnowledgeIndexStatus {

    private KnowledgeIndexStatus() {
    }

    /** 索引完成，chunk 已写入向量库 */
    public static final String READY = "ready";
    /** 已创建 async_job，尚未被 Worker 消费 */
    public static final String PENDING_INDEX = "pending_index";
    /** Worker 已 markRunning，正在调 Python index */
    public static final String INDEXING = "indexing";
    /** index 失败，见 async_job.error_message */
    public static final String INDEX_FAILED = "index_failed";
}