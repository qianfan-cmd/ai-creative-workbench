package com.workbench.backendjava.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 流式结束后批量写入一轮 user + assistant 消息。
 */
@Data
public class ChatMessagesCreateRequest {

    @NotBlank(message = "用户消息不能为空")
    private String userContent;

    @NotBlank(message = "助手回复不能为空")
    private String assistantContent;
}
