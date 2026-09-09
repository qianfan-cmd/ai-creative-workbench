package com.workbench.backendjava.vo;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class KnowledgeReindexAllVO {
    private int total;
    private int succeeded;
    private List<KnowledgeReindexFailureVO> failed = new ArrayList<>();
}
