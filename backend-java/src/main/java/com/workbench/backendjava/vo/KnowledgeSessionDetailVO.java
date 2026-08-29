package com.workbench.backendjava.vo;

import lombok.Data;

import java.util.List;

/** 会话详情：含完整 turns 线程 */
@Data
public class KnowledgeSessionDetailVO {
    private Long id;
    private String title;
    private List<KnowledgeTurnVO> turns;
}
