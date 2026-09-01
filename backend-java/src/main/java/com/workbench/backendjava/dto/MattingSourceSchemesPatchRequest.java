package com.workbench.backendjava.dto;

import lombok.Data;

import java.util.List;

@Data
public class MattingSourceSchemesPatchRequest {
    /** 勾选/取消勾选的方案 id */
    private String schemeId;
    private Boolean selected;
    /** 要删除的方案 id 列表 */
    private List<String> deleteIds;
}
