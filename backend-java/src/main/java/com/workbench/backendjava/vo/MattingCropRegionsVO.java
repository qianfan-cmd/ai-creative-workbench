package com.workbench.backendjava.vo;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * 框选区域查询结果（对齐美术机台 crop/list：仅坐标与 useOriginal，供刷新/切任务恢复 UI）。
 */
@Data
public class MattingCropRegionsVO {
    private Boolean useOriginal;
    private List<RegionItem> regions = new ArrayList<>();

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
