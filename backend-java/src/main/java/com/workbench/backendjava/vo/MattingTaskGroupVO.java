package com.workbench.backendjava.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class MattingTaskGroupVO {
    private Long id;
    private String name;
    private Integer sortOrder;
    private LocalDateTime updatedAt;
}
