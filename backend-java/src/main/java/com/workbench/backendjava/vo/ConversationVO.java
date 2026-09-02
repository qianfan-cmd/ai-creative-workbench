package com.workbench.backendjava.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ConversationVO {
    private Long id;
    private String title;
    private Boolean pinned;
    private LocalDateTime updatedAt;
}
