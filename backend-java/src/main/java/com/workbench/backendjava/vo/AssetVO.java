package com.workbench.backendjava.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class AssetVO {

    /**
     * 字段	来源	说明
     * id	Entity	主键
     * name	Entity	文件名
     * path	Entity.url	DB 相对路径
     * url	拼出来的	publicBaseUrl + path
     * size	Entity	字节数
     * type	Entity	MIME
     * createdAt	Entity	上传时间，列表常用
     */
    private Long id;

    private String name;

    private String url;

    private String path;

    private Long size;

    private String type;

    private LocalDateTime createdAt;
}
