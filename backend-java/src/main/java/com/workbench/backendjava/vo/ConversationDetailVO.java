package com.workbench.backendjava.vo;

import lombok.Data;

import java.util.List;

@Data
public class ConversationDetailVO {
    private Long id;
    private String title;
    private List<MessageVO> messages;
}
