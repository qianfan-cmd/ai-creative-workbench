package com.workbench.backendjava.vo;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class MattingElementsVO {
    /** 按来源整图 → 切割区域两级分组 */
    private List<SourceElementsVO> sources = new ArrayList<>();
    /** @deprecated 扁平列表，保留兼容旧前端 */
    private List<RegionElementsVO> regions;
    private String detectStatus;
    private String detectError;
    private Integer candidateCount;

    @Data
    public static class SourceElementsVO {
        private String sourceId;
        private String label;
        private String imageUrl;
        private List<RegionElementsVO> regions = new ArrayList<>();
    }

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
