package com.workbench.backendjava.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("knowledge_document_tag")
public class KnowledgeDocumentTag {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long documentId;

    private Long tagId;

    /** ai | user */
    private String source;

    private LocalDateTime createdAt;
}
