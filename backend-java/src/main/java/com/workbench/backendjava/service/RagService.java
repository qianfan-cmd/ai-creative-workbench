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
 * RAG 知识库问答业务层（≈ ChatService）。
 */
@Slf4j
@RequiredArgsConstructor
@Service
public class RagService {

    private static final int RAG_HISTORY_LIMIT = 10;

    private final PythonAiClient pythonAiClient;
    private final KnowledgeSessionService knowledgeSessionService;

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
        List<RagHistoryItem> history = resolveHistory(request);

        log.info("RAG 查询, userId={}, topK={}, historySize={}, question={}",
                userId, topK, history.size(), question);

        return pythonAiClient.ragQuery(question, topK, history);
    }

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
        List<RagHistoryItem> history = resolveHistory(request);

        log.info("RAG 流式查询, userId={}, topK={}, historySize={}, question={}",
                userId, topK, history.size(), question);

        SseEmitter emitter = new SseEmitter(120_000L);
        pythonAiClient.ragQueryStream(question, topK, history, emitter);
        return emitter;
    }

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
