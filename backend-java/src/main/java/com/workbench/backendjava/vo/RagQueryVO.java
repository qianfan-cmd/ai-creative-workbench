package com.workbench.backendjava.vo;

import lombok.Data;

import java.util.List;

@Data
public class RagQueryVO {
    private String answer;
    private List<RagReferenceVO> references;
}
