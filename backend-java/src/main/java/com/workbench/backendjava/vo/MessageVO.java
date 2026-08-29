package com.workbench.backendjava.vo;

import lombok.Data;

@Data
public class MessageVO {
    private Long id;
    private String role;
    private String content;
}
