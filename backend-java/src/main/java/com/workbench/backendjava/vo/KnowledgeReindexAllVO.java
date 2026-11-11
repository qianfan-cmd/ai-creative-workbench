package com.workbench.backendjava.vo;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class KnowledgeReindexAllVO {
    private int total;
    private int succeeded;
    private List<KnowledgeReindexFailureVO> failed = new ArrayList<>();
    /** true：Rabbit 开启时 succeeded 表示成功入队数，索引在后台执行 */
    private boolean asyncEnqueue;
}
