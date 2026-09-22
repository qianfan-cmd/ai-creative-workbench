package com.workbench.backendjava.service;

import com.workbench.backendjava.client.PythonAiClient;
import com.workbench.backendjava.common.BusinessException;
import com.workbench.backendjava.common.LoginUserContext;
import com.workbench.backendjava.dto.RagHistoryItem;
import com.workbench.backendjava.dto.RagQueryRequest;
import com.workbench.backendjava.vo.RagQueryVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Collections;
import java.util.List;

/**
 * RAG 知识库问答业务层：校验登录与参数，组装多轮 history，委托 {@link PythonAiClient}。
 * 调用方：{@link com.workbench.backendjava.controller.RagController}。
 */
@Slf4j
@RequiredArgsConstructor
@Service
public class RagService {

    /** 传给 Python 的同会话 prior Q/A 上限（不含 references 全文）。 */
    private static final int RAG_HISTORY_LIMIT = 10;

    private final PythonAiClient pythonAiClient;
    private final KnowledgeSessionService knowledgeSessionService;

    /**
     * 非流式 RAG（集成测试/备用）；生产前端用 {@link #streamQuery}。
     * 调用 Python {@code POST /ai/rag/query}。
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

        int topK = request.getTopK() != null ? request.getTopK() : 6;
        List<RagHistoryItem> history = resolveHistory(request);

        log.info("RAG 查询, userId={}, topK={}, historySize={}, question={}",
                userId, topK, history.size(), question);

        return pythonAiClient.ragQuery(question, topK, history);
    }

    /**
     * 流式 RAG：创建 120s {@link SseEmitter}，异步转发 Python SSE。
     * 调用方：{@code POST /api/rag/query/stream}。
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
        int topK = request.getTopK() != null ? request.getTopK() : 6;
        List<RagHistoryItem> history = resolveHistory(request);

        log.info("RAG 流式查询, userId={}, topK={}, historySize={}, question={}",
                userId, topK, history.size(), question);

        SseEmitter emitter = new SseEmitter(120_000L);
        pythonAiClient.ragQueryStream(question, topK, history, emitter);
        return emitter;
    }

    /**
     * 从 {@link KnowledgeSessionService} 加载 prior turns 作为多轮上下文。
     *
     * @param request sessionId 为空则返回空列表；excludeTurnId 用于重新生成时排除当前 turn
     */
    private List<RagHistoryItem> resolveHistory(RagQueryRequest request) {
        if (request.getSessionId() == null) {
            return Collections.emptyList();
        }
        return knowledgeSessionService.getTurnHistory(
                request.getSessionId(),
                request.getExcludeTurnId(),
                RAG_HISTORY_LIMIT
        );
    }
}
