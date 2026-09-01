package com.workbench.backendjava.model;

import com.fasterxml.jackson.annotation.JsonProperty;
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
    private List<SourceScheme> sourceSchemes = new ArrayList<>();
    private List<ConfirmedSource> confirmedSources = new ArrayList<>();

    @Data
    public static class ConfirmedSource {
        private String id;
        private String schemeId;
        private Long sourceAssetId;
        /** AI 生图等外链（入库失败或未入库时用于框选/识别） */
        private String sourceImageUrl;
        private String label;
        private Integer sortOrder;
        /** 该来源是否「使用原图」 */
        private Boolean useOriginal;
    }

    @Data
    public static class SourceScheme {
        private String id;
        private String imageUrl;
        private String prompt;
        private String aspectRatio;
        private List<String> referenceUrls;
        private Boolean selected;
        private Long generationJobId;
    }

    @Data
    public static class CropRegion {
        private String id;
        /** 关联 ConfirmedSource.id */
        private String sourceId;
        @JsonProperty("xPct")
        private Double xPct;
        @JsonProperty("yPct")
        private Double yPct;
        @JsonProperty("wPct")
        private Double wPct;
        @JsonProperty("hPct")
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
