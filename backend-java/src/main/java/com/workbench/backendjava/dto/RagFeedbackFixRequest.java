package com.workbench.backendjava.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class RagFeedbackFixRequest {
    private Long feedbackId;
    private Long turnId;
    private Long userId;
    private String question;
    private String answer;
    private String reason;
    private String reasonDetail;
    private List<Map<String, Object>> references;
}
