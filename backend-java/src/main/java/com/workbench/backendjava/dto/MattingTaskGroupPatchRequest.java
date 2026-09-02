package com.workbench.backendjava.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class MattingTaskGroupPatchRequest {

    @Size(max = 20)
    private String name;

    private Integer sortOrder;
}
