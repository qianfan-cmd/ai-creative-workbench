package com.workbench.backendjava.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * Chat 流式请求 — 可选 conversationId 用于多轮上下文。
 */
@Data
public class ChatStreamRequest {

    /** 已有会话 id；为空时仅单轮（Phase C 由前端首次提问时创建） */
    private Long conversationId;

    @NotBlank(message = "消息不能为空")
    private String message;
}
