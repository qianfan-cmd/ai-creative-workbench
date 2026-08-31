package com.workbench.backendjava.service;

import com.workbench.backendjava.client.PythonAiClient;
import com.workbench.backendjava.common.BusinessException;
import com.workbench.backendjava.common.LoginUserContext;
import com.workbench.backendjava.dto.OpsImageGenerateRequest;
import com.workbench.backendjava.vo.GenerationJobVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/** 独立 Ops 生图（素材库 AI 生图等，不绑定 campaign/matting 任务） */
@Service
@RequiredArgsConstructor
public class OpsImageService {

    private final GenerationJobService generationJobService;

    public GenerationJobVO generate(OpsImageGenerateRequest request) {
        Long userId = LoginUserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(401, "未登录");
        }
        String prompt = request.getPrompt();
        if (prompt == null || prompt.isBlank()) {
            throw new BusinessException(400, "prompt 不能为空");
        }
        int count = request.getCount() != null ? request.getCount() : 4;
        return generationJobService.runJob(
                userId,
                "image_gen",
                null,
                null,
                prompt.trim(),
                request.getSourceUrl(),
                count,
                request.getAspectRatio()
        );
    }
}
