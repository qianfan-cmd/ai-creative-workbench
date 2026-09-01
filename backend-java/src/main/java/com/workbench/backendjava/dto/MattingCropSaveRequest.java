package com.workbench.backendjava.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

@Data
public class MattingCropSaveRequest {
    /** 草稿：仅更新单个来源 */
    private String sourceId;
    private Boolean useOriginal;
    private List<CropRegionItem> regions;
    /** 正式保存：全量来源框选 */
    private List<SourceCropItem> sources;
    /** true：草稿自动保存，仅持久化坐标，不清空后续阶段数据 */
    private Boolean draft;

    @Data
    public static class SourceCropItem {
        private String sourceId;
        private Boolean useOriginal;
        private List<CropRegionItem> regions;
    }

    @Data
    public static class CropRegionItem {
        private String id;
        @JsonProperty("xPct")
        private Double xPct;
        @JsonProperty("yPct")
        private Double yPct;
        @JsonProperty("wPct")
        private Double wPct;
        @JsonProperty("hPct")
        private Double hPct;
        private Long subAssetId;
    }
}
