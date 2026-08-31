package com.workbench.backendjava.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/** 外部 AI 调用审计 — 每次生图/抠图/文案调用写一条 */
@Data
@TableName("ai_call_log")
public class AiCallLog {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    /** copy | image_gen | matting */
    private String scene;

    private String provider;

    private String model;

    private String prompt;

    private String responseSummary;

    /** success | failed */
    private String status;

    private Integer costMs;

    private LocalDateTime createdAt;
}
