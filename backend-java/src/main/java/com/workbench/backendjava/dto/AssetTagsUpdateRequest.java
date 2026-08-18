package com.workbench.backendjava.dto;

import lombok.Data;

import java.util.List;

@Data
public class AssetTagsUpdateRequest {

    private List<Long> tagIds;
}
