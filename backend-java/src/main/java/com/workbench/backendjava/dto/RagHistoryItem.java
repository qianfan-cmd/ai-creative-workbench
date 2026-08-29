package com.workbench.backendjava.dto;

import lombok.Data;

/** RAG 多轮上下文 — 传给 Python 的 prior Q/A */
@Data
public class RagHistoryItem {
    private String question;
    private String answer;
}
