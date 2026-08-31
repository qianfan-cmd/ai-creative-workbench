package com.workbench.backendjava.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/** 一次生图/抠图任务 — 与 Python Provider 调用结果对应 */
@Data
@TableName("generation_job")
public class GenerationJob {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    /** matting | image_gen */
    private String jobType;

    private Long refTaskId;

    private Long refDraftId;

    /** pending | running | done | failed */
    private String status;

    /** seedream | dashscope_wanx */
    private String providerUsed;

    private String inputJson;

    private String candidatesJson;

    private String selectedIds;

    private String errorMessage;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @TableLogic
    private Integer deleted;
}
