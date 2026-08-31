package com.workbench.backendjava.model;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/** ops_matting_task.config_json 结构化映射 */
@Data
public class MattingConfig {
    private List<CropRegion> cropRegions = new ArrayList<>();
    private List<ElementItem> elements = new ArrayList<>();
    private List<ElementImage> elementImages = new ArrayList<>();
    private Integer candidateCount = 2;
    private String detectStatus = "idle";
    private String extractStatus = "idle";
    private String detectError;
    private String extractError;

    @Data
    public static class CropRegion {
        private String id;
        private Double xPct;
        private Double yPct;
        private Double wPct;
        private Double hPct;
        private Long subAssetId;
        private String subAssetUrl;
        private Boolean useOriginal;
    }

    @Data
    public static class ElementItem {
        private String id;
        private String regionId;
        private String groupName;
        private String elementName;
        private Boolean checked = true;
        private Integer sortOrder;
        private String createType = "ai_identified";
    }

    @Data
    public static class ElementImage {
        private String elementId;
        private String elementName;
        private Integer slotIndex;
        private String url;
        private Boolean selected;
        private String status = "pending";
        private String errorMessage;
    }
}
