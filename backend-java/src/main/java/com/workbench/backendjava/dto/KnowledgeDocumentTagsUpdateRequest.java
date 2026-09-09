package com.workbench.backendjava.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class KnowledgeDocumentTagsUpdateRequest {

    @NotNull
    private List<Long> tagIds;
}
