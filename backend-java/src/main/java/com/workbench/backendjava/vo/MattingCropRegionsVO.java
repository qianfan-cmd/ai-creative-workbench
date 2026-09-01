package com.workbench.backendjava.vo;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * 框选区域查询结果（按已确认来源分组，对齐美术机台 crop/list）。
 */
@Data
public class MattingCropRegionsVO {
    private List<SourceCropVO> sources = new ArrayList<>();

    @Data
    public static class SourceCropVO {
        private String sourceId;
        private Boolean useOriginal;
        private List<RegionItem> regions = new ArrayList<>();
    }

    @Data
    public static class RegionItem {
        private String id;
        @JsonProperty("xPct")
        private Double xPct;
        @JsonProperty("yPct")
        private Double yPct;
        @JsonProperty("wPct")
        private Double wPct;
        @JsonProperty("hPct")
        private Double hPct;
    }
}
