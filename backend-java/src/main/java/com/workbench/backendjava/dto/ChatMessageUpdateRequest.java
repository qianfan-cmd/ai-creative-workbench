package com.workbench.backendjava.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** 重新生成后更新 assistant 消息内容 */
@Data
public class ChatMessageUpdateRequest {

    @NotBlank(message = "助手回复不能为空")
    private String assistantContent;
}
