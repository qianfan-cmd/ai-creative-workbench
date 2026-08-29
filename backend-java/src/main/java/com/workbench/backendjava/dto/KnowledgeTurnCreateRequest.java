package com.workbench.backendjava.dto;

import com.workbench.backendjava.vo.RagReferenceVO;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

/**
 * 流式结束后持久化一轮 Q/A。
 */
@Data
public class KnowledgeTurnCreateRequest {

    @NotBlank(message = "问题不能为空")
    private String question;

    private String answer;

    private List<RagReferenceVO> references;
}
