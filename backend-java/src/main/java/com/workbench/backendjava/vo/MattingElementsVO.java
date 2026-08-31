package com.workbench.backendjava.vo;

import lombok.Data;

import java.util.List;

@Data
public class MattingElementsVO {
    private List<RegionElementsVO> regions;
    private String detectStatus;
    private String detectError;
    private Integer candidateCount;

    @Data
    public static class RegionElementsVO {
        private String regionId;
        private String regionLabel;
        private String imageUrl;
        private List<GroupElementsVO> groups;
    }

    @Data
    public static class GroupElementsVO {
        private String groupName;
        private List<ElementRowVO> elements;
    }

    @Data
    public static class ElementRowVO {
        private String id;
        private String regionId;
        private String groupName;
        private String elementName;
        private Boolean checked;
        private String createType;
    }
}
