package com.workbench.backendjava.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class RagFeedbackActionVO {
    private Long id;
    private Long feedbackId;
    private Long turnId;
    private Integer triageStep;
    private String actionType;
    private String detailJson;
    private String status;
    private LocalDateTime createdAt;
}
