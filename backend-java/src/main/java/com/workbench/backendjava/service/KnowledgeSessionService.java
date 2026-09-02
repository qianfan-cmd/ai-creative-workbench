package com.workbench.backendjava.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.workbench.backendjava.common.BusinessException;
import com.workbench.backendjava.common.LoginUserContext;
import com.workbench.backendjava.dto.KnowledgeSessionPatchRequest;
import com.workbench.backendjava.dto.KnowledgeTurnCreateRequest;
import com.workbench.backendjava.entity.KnowledgeSession;
import com.workbench.backendjava.entity.KnowledgeTurn;
import com.workbench.backendjava.mapper.KnowledgeSessionMapper;
import com.workbench.backendjava.mapper.KnowledgeTurnMapper;
import com.workbench.backendjava.vo.KnowledgeSessionDetailVO;
import com.workbench.backendjava.vo.KnowledgeSessionVO;
import com.workbench.backendjava.vo.KnowledgeTurnVO;
import com.workbench.backendjava.vo.RagReferenceVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 知识库历史会话 — MySQL 持久化，供左栏切换与刷新恢复。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class KnowledgeSessionService {

    private static final int TITLE_MAX_LEN = 30;

    private final KnowledgeSessionMapper sessionMapper;
    private final KnowledgeTurnMapper turnMapper;
    private final ObjectMapper objectMapper;

    public List<KnowledgeSessionVO> listSessions() {
        Long userId = requireUserId();
        List<KnowledgeSession> sessions = sessionMapper.selectList(
                new LambdaQueryWrapper<KnowledgeSession>()
                        .eq(KnowledgeSession::getUserId, userId)
                        .orderByDesc(KnowledgeSession::getPinned)
                        .orderByDesc(KnowledgeSession::getUpdatedAt)
        );
        return sessions.stream().map(this::toSessionVO).collect(Collectors.toList());
    }

    @Transactional
    public KnowledgeSessionVO createSession() {
        Long userId = requireUserId();
        KnowledgeSession session = new KnowledgeSession();
        session.setUserId(userId);
        session.setTitle("新问答");
        session.setPinned(0);
        session.setCreatedAt(LocalDateTime.now());
        session.setUpdatedAt(LocalDateTime.now());
        sessionMapper.insert(session);
        return toSessionVO(session);
    }

    public KnowledgeSessionDetailVO getSessionDetail(Long sessionId) {
        Long userId = requireUserId();
        KnowledgeSession session = getOwnedSession(sessionId, userId);

        List<KnowledgeTurn> turns = turnMapper.selectList(
                new LambdaQueryWrapper<KnowledgeTurn>()
                        .eq(KnowledgeTurn::getSessionId, sessionId)
                        .orderByAsc(KnowledgeTurn::getCreatedAt)
        );

        KnowledgeSessionDetailVO vo = new KnowledgeSessionDetailVO();
        vo.setId(session.getId());
        vo.setTitle(session.getTitle());
        vo.setTurns(turns.stream().map(this::toTurnVO).collect(Collectors.toList()));
        return vo;
    }

    @Transactional
    public KnowledgeTurnVO addTurn(Long sessionId, KnowledgeTurnCreateRequest request) {
        Long userId = requireUserId();
        KnowledgeSession session = getOwnedSession(sessionId, userId);

        KnowledgeTurn turn = new KnowledgeTurn();
        turn.setSessionId(sessionId);
        turn.setQuestion(request.getQuestion().trim());
        turn.setAnswer(request.getAnswer());
        turn.setReferencesJson(writeReferencesJson(request.getReferences()));
        turn.setCreatedAt(LocalDateTime.now());
        turnMapper.insert(turn);

        // 首问时更新 session 标题
        if ("新问答".equals(session.getTitle()) || session.getTitle().isBlank()) {
            session.setTitle(truncateTitle(request.getQuestion()));
        }
        session.setUpdatedAt(LocalDateTime.now());
        sessionMapper.updateById(session);

        log.info("知识库 turn 入库, userId={}, sessionId={}, turnId={}", userId, sessionId, turn.getId());
        return toTurnVO(turn);
    }

    @Transactional
    public KnowledgeTurnVO updateTurn(Long sessionId, Long turnId, KnowledgeTurnCreateRequest request) {
        Long userId = requireUserId();
        getOwnedSession(sessionId, userId);

        KnowledgeTurn turn = turnMapper.selectById(turnId);
        if (turn == null || !sessionId.equals(turn.getSessionId())) {
            throw new BusinessException(404, "问答记录不存在");
        }

        turn.setQuestion(request.getQuestion().trim());
        turn.setAnswer(request.getAnswer());
        turn.setReferencesJson(writeReferencesJson(request.getReferences()));
        turnMapper.updateById(turn);

        KnowledgeSession session = sessionMapper.selectById(sessionId);
        if (session != null) {
            session.setUpdatedAt(LocalDateTime.now());
            sessionMapper.updateById(session);
        }

        return toTurnVO(turn);
    }

    @Transactional
    public void deleteSession(Long sessionId) {
        Long userId = requireUserId();
        getOwnedSession(sessionId, userId);
        sessionMapper.deleteById(sessionId);
    }

    @Transactional
    public KnowledgeSessionVO patchSession(Long sessionId, KnowledgeSessionPatchRequest request) {
        Long userId = requireUserId();
        KnowledgeSession session = getOwnedSession(sessionId, userId);
        if (request.getTitle() != null) {
            String title = request.getTitle().trim();
            if (title.isEmpty()) {
                throw new BusinessException(400, "标题不能为空");
            }
            session.setTitle(truncateTitle(title));
        }
        if (request.getPinned() != null) {
            session.setPinned(Boolean.TRUE.equals(request.getPinned()) ? 1 : 0);
        }
        session.setUpdatedAt(LocalDateTime.now());
        sessionMapper.updateById(session);
        return toSessionVO(session);
    }

    private Long requireUserId() {
        Long userId = LoginUserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(401, "未登录");
        }
        return userId;
    }

    private KnowledgeSession getOwnedSession(Long sessionId, Long userId) {
        KnowledgeSession session = sessionMapper.selectById(sessionId);
        if (session == null || !userId.equals(session.getUserId())) {
            throw new BusinessException(404, "会话不存在");
        }
        return session;
    }

    private String truncateTitle(String question) {
        String q = question.trim();
        if (q.length() <= TITLE_MAX_LEN) {
            return q;
        }
        return q.substring(0, TITLE_MAX_LEN) + "…";
    }

    private String writeReferencesJson(List<RagReferenceVO> references) {
        try {
            return objectMapper.writeValueAsString(references != null ? references : Collections.emptyList());
        } catch (JsonProcessingException e) {
            throw new BusinessException(500, "引用序列化失败");
        }
    }

    private List<RagReferenceVO> readReferencesJson(String json) {
        if (json == null || json.isBlank()) {
            return Collections.emptyList();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<RagReferenceVO>>() {});
        } catch (JsonProcessingException e) {
            log.warn("references_json 解析失败: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    private KnowledgeSessionVO toSessionVO(KnowledgeSession session) {
        KnowledgeSessionVO vo = new KnowledgeSessionVO();
        vo.setId(session.getId());
        vo.setTitle(session.getTitle());
        vo.setPinned(session.getPinned() != null && session.getPinned() == 1);
        vo.setUpdatedAt(session.getUpdatedAt());
        return vo;
    }

    private KnowledgeTurnVO toTurnVO(KnowledgeTurn turn) {
        KnowledgeTurnVO vo = new KnowledgeTurnVO();
        vo.setId(turn.getId());
        vo.setQuestion(turn.getQuestion());
        vo.setAnswer(turn.getAnswer());
        vo.setReferences(readReferencesJson(turn.getReferencesJson()));
        return vo;
    }

    /**
     * 读取同会话 prior turns，供 RAG 多轮上下文（不含 references 全文）。
     *
     * @param sessionId      会话 id
     * @param excludeTurnId  重新生成时排除的 turn（可为 null）
     * @param limit          最多几轮
     */
    public List<com.workbench.backendjava.dto.RagHistoryItem> getTurnHistory(
            Long sessionId,
            Long excludeTurnId,
            int limit
    ) {
        Long userId = requireUserId();
        getOwnedSession(sessionId, userId);

        List<KnowledgeTurn> turns = turnMapper.selectList(
                new LambdaQueryWrapper<KnowledgeTurn>()
                        .eq(KnowledgeTurn::getSessionId, sessionId)
                        .ne(excludeTurnId != null, KnowledgeTurn::getId, excludeTurnId)
                        .orderByDesc(KnowledgeTurn::getCreatedAt)
                        .last("LIMIT " + limit)
        );
        // 倒序取出后反转为时间正序
        java.util.Collections.reverse(turns);

        return turns.stream()
                .filter(t -> t.getQuestion() != null && t.getAnswer() != null && !t.getAnswer().isBlank())
                .map(t -> {
                    com.workbench.backendjava.dto.RagHistoryItem item =
                            new com.workbench.backendjava.dto.RagHistoryItem();
                    item.setQuestion(t.getQuestion());
                    item.setAnswer(t.getAnswer());
                    return item;
                })
                .collect(Collectors.toList());
    }
}
