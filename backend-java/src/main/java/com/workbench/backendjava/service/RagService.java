package com.workbench.backendjava.service;

import com.workbench.backendjava.client.PythonAiClient;
import com.workbench.backendjava.common.BusinessException;
import com.workbench.backendjava.common.LoginUserContext;
import com.workbench.backendjava.dto.RagQueryRequest;
import com.workbench.backendjava.vo.RagQueryVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * RAG 知识库问答业务层（≈ ChatService）。
 *
 * 职责：
 *   1. 校验用户已登录
 *   2. 调用 PythonAiClient 做检索 + 生成
 *   3. 返回 RagQueryVO 给 Controller
 */
@Slf4j
@RequiredArgsConstructor
@Service
public class RagService {
    private final PythonAiClient pythonAiClient;

    /**
     * 执行一次 RAG 问答。
     *
     * @param request 前端传入的问题 + topK
     * @return 答案 + 引用片段
     */
    public RagQueryVO query(RagQueryRequest request) {
        Long userId = LoginUserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(401, "未登录");
        }

        String question = request.getQuestion();
        if (question.isEmpty()) {
            throw new BusinessException(400, "问题不能为空");
        }

        int topK = request.getTopK() != null ? request.getTopK() : 3;

        log.info("RAG 查询, userId={}, topK={}, question={}", userId, topK, question);

        return pythonAiClient.ragQuery(question, topK);
    }

    /**
     * RAG 流式回答 - 创建 SseEmitter，交给 pythonAiClient 异步转发
     */
    public SseEmitter streamQuery(RagQueryRequest request) {
        Long userId = LoginUserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(401, "未登录");
        }
        String question = request.getQuestion().trim();
        if (question.isEmpty()) {
            throw new BusinessException(400, "问题不能为空");
        }
        int topK = request.getTopK() != null ? request.getTopK() : 3;

        log.info("RAG 流式查询, userId={}, topK={}, question={}", userId, topK, question);

        SseEmitter emitter = new SseEmitter(120_000L);
        pythonAiClient.ragQueryStream(question, topK, emitter);
        return emitter;
    }
}
