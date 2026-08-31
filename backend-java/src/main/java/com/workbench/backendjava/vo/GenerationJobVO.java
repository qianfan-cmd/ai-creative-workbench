package com.workbench.backendjava.vo;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class GenerationJobVO {
    private Long id;
    private String jobType;
    private String status;
    private String providerUsed;
    private List<ImageCandidateVO> candidates;
    private String errorMessage;
    private LocalDateTime createdAt;
}
