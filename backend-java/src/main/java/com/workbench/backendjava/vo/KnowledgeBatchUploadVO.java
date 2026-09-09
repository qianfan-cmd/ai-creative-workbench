package com.workbench.backendjava.vo;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class KnowledgeBatchUploadVO {
    private int total;
    private List<KnowledgeUploadVO> succeeded = new ArrayList<>();
    private List<KnowledgeUploadFailureVO> failed = new ArrayList<>();
}
