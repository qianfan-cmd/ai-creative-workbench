package com.workbench.backendjava.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 活动帖草稿 — 模块 B Campaign 主实体。
 * activityJson 存左栏表单快照；copyTitle/copyBody 在文案 Tab 生成后写入。
 */
@Data
@TableName("campaign_draft")
public class CampaignDraft {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    /** 列表/侧栏展示用，通常取活动主题 theme */
    private String title;

    /** 侧栏置顶：0 否 1 是 */
    private Integer pinned;

    /** 活动表单 JSON 字符串，与 KnowledgeTurn.referencesJson 同样处理方式 */
    private String activityJson;

    private String copyTitle;

    private String copyBody;

    private Long coverAssetId;

    /** 附图 asset id 数组的 JSON 字符串，Phase 4 再用 */
    private String imageAssetIds;

    /** draft | ready */
    private String status;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @TableLogic
    private Integer deleted;
}