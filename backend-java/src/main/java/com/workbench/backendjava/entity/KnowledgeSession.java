package com.workbench.backendjava.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 知识库问答会话 — 对应左栏「历史问答」一条记录。
 * 一个 session 下有多条 {@link KnowledgeTurn}（多轮线程）。
 */
@Data
@TableName("knowledge_session")
public class KnowledgeSession {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 所属用户，与 JWT 中 userId 对应 */
    private Long userId;

    /** 侧栏展示标题，通常取首问前 30 字 */
    private String title;

    /** 1=置顶 */
    private Integer pinned;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @TableLogic
    private Integer deleted;
}
