package com.workbench.backendjava.vo;

import lombok.Data;

@Data
public class AssetStatsVO {

    /** 素材总数 */
    private Long total;

    /** 近 7 天上传数 */
    private Long last7DaysCount;

    /** 上一个 7 天（第 8–14 天）上传数，用于环比 */
    private Long prev7DaysCount;

    /** 知识库文档数（Phase 2 前为 0） */
    private Long knowledgeDocCount;
}
