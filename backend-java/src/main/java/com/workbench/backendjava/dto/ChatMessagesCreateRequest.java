package com.workbench.backendjava.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

/**
 * 流式结束后批量写入一轮 user + assistant 消息。
 */
@Data
public class ChatMessagesCreateRequest {

    @NotBlank(message = "用户消息不能为空")
    private String userContent;

    @NotBlank(message = "助手回复不能为空")
    private String assistantContent;

    /** 用户消息附图 URL（可选，持久化后用于历史展示） */
    private List<String> userImageUrls;
}
