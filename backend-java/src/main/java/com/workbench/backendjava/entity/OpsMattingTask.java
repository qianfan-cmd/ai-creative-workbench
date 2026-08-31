package com.workbench.backendjava.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/** 抠图工作台任务 — stage 1~4 对应 UI 四步 */
@Data
@TableName("ops_matting_task")
public class OpsMattingTask {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    private String title;

    /** 1源图 2配置 3候选 4保存 */
    private Integer stage;

    /** draft | running | done */
    private String status;

    private Long sourceAssetId;

    private String configJson;

    /** 步骤③选中的候选 JSON */
    private String selectedCandidate;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @TableLogic
    private Integer deleted;
}
