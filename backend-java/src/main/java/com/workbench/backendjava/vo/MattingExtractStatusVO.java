package com.workbench.backendjava.vo;

import lombok.Data;

import java.util.List;

@Data
public class MattingExtractStatusVO {
    private String extractStatus;
    private String extractError;
    private Integer candidateCount;
    private List<ElementExtractVO> elements;

    @Data
    public static class ElementExtractVO {
        private String elementId;
        private String elementName;
        private String groupName;
        private String status;
        private String errorMessage;
        private List<ImageSlotVO> images;
        private Integer selectedSlotIndex;
    }

    @Data
    public static class ImageSlotVO {
        private Integer slotIndex;
        private String url;
        private Boolean selected;
        private String status;
    }
}
