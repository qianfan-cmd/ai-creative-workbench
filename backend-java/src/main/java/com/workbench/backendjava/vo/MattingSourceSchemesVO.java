package com.workbench.backendjava.vo;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class MattingSourceSchemesVO {
    private List<SchemeItem> schemes = new ArrayList<>();

    @Data
    public static class SchemeItem {
        private String id;
        private String imageUrl;
        private String prompt;
        private String aspectRatio;
        private List<String> referenceUrls;
        private Boolean selected;
        private Long generationJobId;
    }
}
