package com.workbench.backendjava.dto;

import lombok.Data;

import java.util.List;

@Data
public class MattingCropSaveRequest {
    private List<CropRegionItem> regions;
    private Boolean useOriginal;

    @Data
    public static class CropRegionItem {
        private String id;
        private Double xPct;
        private Double yPct;
        private Double wPct;
        private Double hPct;
        private Long subAssetId;
    }
}
