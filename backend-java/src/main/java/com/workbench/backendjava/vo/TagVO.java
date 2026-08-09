package com.workbench.backendjava.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class TagVO {

    private Long id;

    private String name;

    private String color;

    private LocalDateTime createdAt;
}
