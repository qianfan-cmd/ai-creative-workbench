package com.workbench.backendjava.vo;

import lombok.Data;

import java.time.LocalDateTime;

/** 历史问答侧栏单项 */
@Data
public class KnowledgeSessionVO {
    private Long id;
    private String title;
    private Boolean pinned;
    private LocalDateTime updatedAt;
}
