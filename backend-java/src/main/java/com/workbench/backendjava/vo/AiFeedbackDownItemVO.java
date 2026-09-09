package com.workbench.backendjava.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class AiFeedbackDownItemVO {
    private Long id;
    private Long userId;
    private String username;
    private String scene;
    private String refType;
    private Long refId;
    private String reason;
    private String reasonDetail;
    private String summary;
    private LocalDateTime createdAt;
    private java.util.List<RagFeedbackActionVO> ragActions = new java.util.ArrayList<>();
}
