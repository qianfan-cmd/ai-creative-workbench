package com.workbench.backendjava.vo;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class KnowledgeBatchDeleteVO {
    private int total;
    private List<Long> deletedIds = new ArrayList<>();
    private List<KnowledgeDeleteFailureVO> failures = new ArrayList<>();
}
