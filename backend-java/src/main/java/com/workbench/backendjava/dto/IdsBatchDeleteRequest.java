package com.workbench.backendjava.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class IdsBatchDeleteRequest {
    @NotEmpty
    private List<Long> ids;
}
