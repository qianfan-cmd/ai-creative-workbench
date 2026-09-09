package com.workbench.backendjava.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class AiFeedbackVO {
    private Long id;
    private String scene;
    private String refType;
    private Long refId;
    private String rating;
    private String reason;
    private String reasonDetail;
    private LocalDateTime createdAt;
}
