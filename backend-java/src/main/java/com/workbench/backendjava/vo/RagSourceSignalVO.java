package com.workbench.backendjava.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class RagSourceSignalVO {
    private String source;
    private Integer penalty;
    private Integer boost;
    private LocalDateTime updatedAt;
}
