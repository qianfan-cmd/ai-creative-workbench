package com.workbench.backendjava.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("ai_feedback")
public class AiFeedback {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    /** rag | chat | image_gen */
    private String scene;

    /** knowledge_turn | message | generation_job */
    private String refType;

    private Long refId;

    /** up | down */
    private String rating;

    /** incomplete_list | wrong_fact | irrelevant | other */
    private String reason;

    /** 点踩补充说明（选 other 等时用户填写） */
    private String reasonDetail;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
