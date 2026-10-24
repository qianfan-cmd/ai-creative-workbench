package com.workbench.backendjava.common;

/**
 * async_job 表 任务状态表
 * 不用enum是为了与MyBayis 字段、JSON返回值直接对齐字符表
 */
public class AsyncJobConstants {

    private AsyncJobConstants(){}

    /**
     * 新上传文档后的首次向量索引
     */
    public static final String TYPE_DOCUMENT_INDEX = "document_index";

    /**
     * 单文档 reindex （磁盘重读再index）
     */
    public static final String TYPE_REINDEX = "reindex";

    /**
     * Admin 全库 reindex
     */
    public static final String TYPE_REINDEX_ALL = "reindex_all";

    /**
     * 等待中
     */
    public static final String STATUS_PENDING = "pending";

    /**
     * 进行中
     */
    public static final String STATUS_RUNNING = "running";

    /**
     * 成功态
     */
    public static final String STATUS_SUCCEEDED = "succeeded";

    /**
     * 失败
     */
    public static final String STATUS_FAILED = "failed";

}
