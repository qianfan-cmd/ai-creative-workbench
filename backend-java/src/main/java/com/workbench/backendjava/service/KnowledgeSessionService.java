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
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 知识库历史会话 — MySQL 持久化，供左栏切换与刷新恢复。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class KnowledgeSessionService {

    /** 会话标题最大字符数（首问自动标题、手动改名时截断）。 */
    private static final int TITLE_MAX_LEN = 30;

    private final KnowledgeSessionMapper sessionMapper;
    private final KnowledgeTurnMapper turnMapper;
    private final AiFeedbackService aiFeedbackService;
    private final ObjectMapper objectMapper;

    /**
     * 当前用户历史会话列表（置顶优先，再按 updatedAt 倒序）。
     * 调用方：{@link com.workbench.backendjava.controller.KnowledgeController#listSessions}；
     * 前端 {@code listKnowledgeSessionsApi}。
     */
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

    /**
     * 新建空会话（默认标题「新问答」）。
     * 调用方：{@link com.workbench.backendjava.controller.KnowledgeController#createSession}；
     * 前端 {@code createKnowledgeSessionApi}。
     */
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

    /**
     * 加载会话详情（全部 turn + 用户反馈 rating）。
     * 调用方：{@link com.workbench.backendjava.controller.KnowledgeController#getSession}；
     * 前端 {@code getKnowledgeSessionApi}。
     */
    public KnowledgeSessionDetailVO getSessionDetail(Long sessionId) {
        Long userId = requireUserId();
        KnowledgeSession session = getOwnedSession(sessionId, userId);

        List<KnowledgeTurn> turns = turnMapper.selectList(
                new LambdaQueryWrapper<KnowledgeTurn>()
                        .eq(KnowledgeTurn::getSessionId, sessionId)
                        .orderByAsc(KnowledgeTurn::getCreatedAt)
        );

        List<Long> turnIds = turns.stream().map(KnowledgeTurn::getId).collect(Collectors.toList());
        Map<Long, String> ratingMap = aiFeedbackService.getRatingMapForRefs(userId, "knowledge_turn", turnIds);

        KnowledgeSessionDetailVO vo = new KnowledgeSessionDetailVO();
        vo.setId(session.getId());
        vo.setTitle(session.getTitle());
        vo.setTurns(turns.stream().map(t -> toTurnVO(t, ratingMap.get(t.getId()))).collect(Collectors.toList()));
        return vo;
    }

    /**
     * 流式问答结束后写入一轮 Q/A 与 references；首问时自动更新会话标题。
     * 调用方：{@link com.workbench.backendjava.controller.KnowledgeController#addTurn}；
     * 前端 {@code saveKnowledgeTurnApi}。
     */
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
        return toTurnVO(turn, null);
    }

    /**
     * 重新生成后覆盖已有 turn 的 Q/A 与 references。
     * 调用方：{@link com.workbench.backendjava.controller.KnowledgeController#updateTurn}；
     * 前端 {@code updateKnowledgeTurnApi}。
     */
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

        String rating = aiFeedbackService.getRatingMapForRefs(userId, "knowledge_turn", List.of(turnId))
                .get(turnId);
        return toTurnVO(turn, rating);
    }

    /**
     * 删除会话（级联由 DB 外键处理 turn）。
     * 调用方：{@link com.workbench.backendjava.controller.KnowledgeController#deleteSession}；
     * 前端 {@code deleteKnowledgeSessionApi}。
     */
    @Transactional
    public void deleteSession(Long sessionId) {
        Long userId = requireUserId();
        getOwnedSession(sessionId, userId);
        sessionMapper.deleteById(sessionId);
    }

    /**
     * 更新会话标题或置顶状态。
     * 调用方：{@link com.workbench.backendjava.controller.KnowledgeController#patchSession}；
     * 前端 {@code patchKnowledgeSessionApi}。
     */
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

    /** 从登录上下文取 userId，未登录抛 401。 */
    private Long requireUserId() {
        Long userId = LoginUserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(401, "未登录");
        }
        return userId;
    }

    /** 校验会话归属当前用户，不存在或不归属抛 404。 */
    private KnowledgeSession getOwnedSession(Long sessionId, Long userId) {
        KnowledgeSession session = sessionMapper.selectById(sessionId);
        if (session == null || !userId.equals(session.getUserId())) {
            throw new BusinessException(404, "会话不存在");
        }
        return session;
    }

    /** 将会话标题截断至 {@link #TITLE_MAX_LEN}，超出追加省略号。 */
    private String truncateTitle(String question) {
        String q = question.trim();
        if (q.length() <= TITLE_MAX_LEN) {
            return q;
        }
        return q.substring(0, TITLE_MAX_LEN) + "…";
    }

    /** 将 RAG 引用列表序列化为 JSON 存入 turn.references_json。 */
    private String writeReferencesJson(List<RagReferenceVO> references) {
        try {
            return objectMapper.writeValueAsString(references != null ? references : Collections.emptyList());
        } catch (JsonProcessingException e) {
            throw new BusinessException(500, "引用序列化失败");
        }
    }

    /** 反序列化 turn.references_json；解析失败返回空列表并打 warn 日志。 */
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

    /** Entity → 侧栏会话 VO。 */
    private KnowledgeSessionVO toSessionVO(KnowledgeSession session) {
        KnowledgeSessionVO vo = new KnowledgeSessionVO();
        vo.setId(session.getId());
        vo.setTitle(session.getTitle());
        vo.setPinned(session.getPinned() != null && session.getPinned() == 1);
        vo.setUpdatedAt(session.getUpdatedAt());
        return vo;
    }

    /** Entity → turn VO，附带用户对该 turn 的 up/down 反馈（可为 null）。 */
    private KnowledgeTurnVO toTurnVO(KnowledgeTurn turn, String userFeedbackRating) {
        KnowledgeTurnVO vo = new KnowledgeTurnVO();
        vo.setId(turn.getId());
        vo.setQuestion(turn.getQuestion());
        vo.setAnswer(turn.getAnswer());
        vo.setReferences(readReferencesJson(turn.getReferencesJson()));
        vo.setUserFeedbackRating(userFeedbackRating);
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
