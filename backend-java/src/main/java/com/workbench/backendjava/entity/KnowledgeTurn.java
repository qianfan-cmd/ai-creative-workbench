package com.workbench.backendjava.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 知识库单轮问答 — 一问一答 + references JSON。
 */
@Data
@TableName("knowledge_turn")
public class KnowledgeTurn {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long sessionId;

    private String question;

    private String answer;

    /** references 数组的 JSON 字符串 */
    private String referencesJson;

    private LocalDateTime createdAt;

    @TableLogic
    private Integer deleted;
}
