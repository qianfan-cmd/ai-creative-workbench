package com.workbench.backendjava.vo;

import lombok.Data;

import java.util.List;

@Data
public class WorkflowSourceVO {
    private Long id;
    private String context;
    private String sourceType;
    private String imageUrl;
    private Long assetId;
    private String originalName;
    private Long size;
    private String contentType;
    private Boolean selected;
    private Integer sortOrder;
    private String prompt;
    private String aspectRatio;
    private List<String> referenceUrls;
    private Long generationJobId;
    /** AI Composer 参考图暂存，不在「直接上传」区展示 */
    private Boolean ephemeralReference;
}
