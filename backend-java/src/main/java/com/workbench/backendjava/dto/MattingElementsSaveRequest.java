package com.workbench.backendjava.dto;

import lombok.Data;

import java.util.List;

@Data
public class MattingElementsSaveRequest {
    private List<ElementSaveItem> items;

    @Data
    public static class ElementSaveItem {
        private String elementId;
        private String candidateUrl;
        private String name;
    }
}
