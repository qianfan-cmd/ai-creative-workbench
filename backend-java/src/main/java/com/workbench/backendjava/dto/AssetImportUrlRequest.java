package com.workbench.backendjava.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class AssetImportUrlRequest {

    @NotBlank
    private String url;

    private String name;

    private List<String> tags;
}
