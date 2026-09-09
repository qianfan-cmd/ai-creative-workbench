package com.workbench.backendjava.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class RagQueryRequest {

    @NotBlank(message = "问题不能为空")
    private String question;

    /**
     * 检索条数
     */
    @Min(1)
    @Max(10)
    private Integer topK = 6;

    /** 知识库会话 id — 有值时 Java 从 knowledge_turn 加载 prior Q/A */
    private Long sessionId;

    /** 重新生成时排除的 turn id，避免把当前轮算进 history */
    private Long excludeTurnId;
}
