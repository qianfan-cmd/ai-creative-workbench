package com.workbench.backendjava.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * Prompt 模板 — 对应 prompt_template 表。
 * userId 为 null 表示系统内置（seed 那 5 条）；scene 用于按场景筛选模板。
 */
@Data
@TableName("prompt_template")
public class PromptTemplate {

    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     *  null = 系统内置模板，不属于某个用户
     */
    private Long userId;

    private String name;

    /**
     * 场景分类：copy_draft | copy_style_playful | matting | image_gen 等
     * Service 层按 scene 查列表时用这个字段
     */
    private String scene;

    /**
     * 模板正文
     */
    private String content;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @TableLogic
    private Integer deleted;
}
