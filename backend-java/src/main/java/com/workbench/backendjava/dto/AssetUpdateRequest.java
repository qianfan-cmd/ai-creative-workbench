package com.workbench.backendjava.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AssetUpdateRequest {

    @NotBlank(message = "文件名不能为空")
    private String name;
}
