package com.workbench.backendjava.vo;

import lombok.Data;

import lombok.Data;

import java.util.List;

@Data
public class MessageVO {
    private Long id;
    private String role;
    private String content;
    /** 用户消息附图（从 content 元数据解析） */
    private List<String> imageUrls;
}
