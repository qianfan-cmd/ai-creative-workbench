package com.workbench.backendjava.dto;

import lombok.Data;

import java.util.List;

@Data
public class MattingSourceConfirmRequest {
    /** AI 生图方案 id 列表 */
    private List<String> schemeIds;
    /** 上传/素材库 asset id 列表 */
    private List<Long> sourceAssetIds;

    /** @deprecated 单方案兼容 */
    private String schemeId;
    /** @deprecated 单 asset 兼容 */
    private Long sourceAssetId;
}
