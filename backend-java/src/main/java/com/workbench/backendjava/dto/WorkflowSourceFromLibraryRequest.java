package com.workbench.backendjava.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class WorkflowSourceFromLibraryRequest {

    @NotBlank(message = "context 不能为空")
    private String context;

    private Long taskId;

    private Long draftId;

    @NotEmpty(message = "assetIds 不能为空")
    private List<Long> assetIds;
}
