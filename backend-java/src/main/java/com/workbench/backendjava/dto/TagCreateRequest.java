package com.workbench.backendjava.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class TagCreateRequest {

    @NotBlank(message = "标签名不能为空")
    private String name;

    private String color;
}
