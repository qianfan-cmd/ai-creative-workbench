package com.workbench.backendjava.dto;

import lombok.Data;

import java.util.List;

@Data
public class WorkflowSourceBatchPatchRequest {
    private Long id;
    private Boolean selected;
    private List<Long> deleteIds;
}
