package com.workbench.backendjava.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("ops_workflow_source")
public class OpsWorkflowSource {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    /** matting | campaign */
    private String context;

    private Long refTaskId;

    private Long refDraftId;

    /** upload | library | ai_gen */
    private String sourceType;

    private String imageUrl;

    private String storagePath;

    private Long assetId;

    private String originalName;

    private Long size;

    private String contentType;

    private Integer selected;

    private Integer sortOrder;

    private String metaJson;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @TableLogic
    private Integer deleted;
}
