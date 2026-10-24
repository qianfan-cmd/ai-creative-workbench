package com.workbench.backendjava.vo;

import lombok.Data;

@Data
public class AsyncJobVO {
    private Long id;
    private String type;
    private String status;
    private Long documentId;
    private String filename;
    private String errorMessage;
    private String createdAt;
    private String updatedAt;
}
