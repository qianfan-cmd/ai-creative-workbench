package com.workbench.backendjava.vo;

import lombok.Data;

import java.util.List;

/** 单轮问答 VO — 返回给前端渲染线程 */
@Data
public class KnowledgeTurnVO {
    private Long id;
    private String question;
    private String answer;
    private List<RagReferenceVO> references;
    /** 当前用户对该 turn 的反馈：up | down */
    private String userFeedbackRating;
}
