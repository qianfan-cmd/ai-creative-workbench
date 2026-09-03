package com.workbench.backendjava.dto;

import lombok.Data;

import java.util.List;

@Data
public class MattingSourceConfirmRequest {
    /** 工作流图源 id 列表（upload/library/ai_gen 统一） */
    private List<Long> workflowSourceIds;

    /** @deprecated 使用 workflowSourceIds */
    private List<String> schemeIds;
    /** @deprecated 使用 workflowSourceIds */
    private List<Long> sourceAssetIds;

    /** @deprecated 单方案兼容 */
    private String schemeId;
    /** @deprecated 单 asset 兼容 */
    private Long sourceAssetId;
}
