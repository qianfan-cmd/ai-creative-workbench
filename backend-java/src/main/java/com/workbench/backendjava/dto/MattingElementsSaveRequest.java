package com.workbench.backendjava.dto;

import lombok.Data;

import java.util.List;

@Data
public class MattingElementsSaveRequest {
    private List<ElementSaveItem> items;
    /** 是否将源图打标写入素材库（步骤⑤可选） */
    private Boolean saveSourceToAssets;
    private List<String> sourceTags;

    @Data
    public static class ElementSaveItem {
        private String elementId;
        private String candidateUrl;
        private String name;
    }
}
