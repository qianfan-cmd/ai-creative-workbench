package com.workbench.backendjava.vo;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * Prompt 模板 — API 返回体。
 */
@Data
public class PromptTemplateVO {

    private Long id;

    private Long userId;

    private String name;

    private String scene;

    private String content;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
