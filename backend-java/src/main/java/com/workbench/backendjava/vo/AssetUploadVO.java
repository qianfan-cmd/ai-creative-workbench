package com.workbench.backendjava.vo;

import lombok.Data;

@Data
public class AssetUploadVO {
    private Long id;
    private String name;
    /**
     * 可访问路径
     */
    private String url;
    /**
     * 相对路径
     */
    private String path;
    private Long size;
    private String type;
}
