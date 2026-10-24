package com.workbench.backendjava.dto.mq;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 发到 knowledge.index 的消息体（JSON）。
 * 只带 id，不带文件 bytes；Worker 从磁盘读文件。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class KnowledgeIndexMessage {

    /** async_job.id */
    private Long jobId;

    private Long userId;

    private Long documentId;

    private String filename;
}