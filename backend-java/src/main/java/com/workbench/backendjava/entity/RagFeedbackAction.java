package com.workbench.backendjava.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("rag_feedback_action")
public class RagFeedbackAction {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long feedbackId;

    private Long turnId;

    private Integer triageStep;

    private String actionType;

    private String detailJson;

    private String status;

    private LocalDateTime createdAt;
}
