package com.workbench.backendjava.dto;

import lombok.Data;

@Data
public class WorkflowSourcePatchRequest {
    private Boolean selected;
    private Integer sortOrder;
}
