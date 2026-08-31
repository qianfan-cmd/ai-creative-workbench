package com.workbench.backendjava.dto;

import lombok.Data;

import java.util.List;

@Data
public class MattingElementsPatchRequest {
    private List<ElementPatch> elements;

    @Data
    public static class ElementPatch {
        private String id;
        private String elementName;
        private Boolean checked;
        private Boolean deleted;
    }
}
