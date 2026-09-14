package com.workbench.backendjava.vo;

import lombok.Data;

@Data
public class ChatMessagePairVO {
    private Long userMessageId;
    private Long assistantMessageId;
}
