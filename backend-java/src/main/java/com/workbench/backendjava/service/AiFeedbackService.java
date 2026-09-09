package com.workbench.backendjava.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.workbench.backendjava.common.BusinessException;
import com.workbench.backendjava.common.LoginUserContext;
import com.workbench.backendjava.dto.AiFeedbackCreateRequest;
import com.workbench.backendjava.entity.AiFeedback;
import com.workbench.backendjava.entity.Conversation;
import com.workbench.backendjava.entity.KnowledgeSession;
import com.workbench.backendjava.entity.KnowledgeTurn;
import com.workbench.backendjava.entity.Message;
import com.workbench.backendjava.entity.User;
import com.workbench.backendjava.mapper.AiFeedbackMapper;
import com.workbench.backendjava.mapper.ConversationMapper;
import com.workbench.backendjava.mapper.KnowledgeSessionMapper;
import com.workbench.backendjava.mapper.KnowledgeTurnMapper;
import com.workbench.backendjava.mapper.MessageMapper;
import com.workbench.backendjava.mapper.UserMapper;
import com.workbench.backendjava.vo.AiFeedbackDownItemVO;
import com.workbench.backendjava.vo.AiFeedbackStatsVO;
import com.workbench.backendjava.vo.AiFeedbackVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AiFeedbackService {

    private static final Set<String> VALID_REASONS = Set.of(
            "incomplete_list", "wrong_fact", "irrelevant", "other"
    );

    private final AiFeedbackMapper feedbackMapper;
    private final KnowledgeTurnMapper turnMapper;
    private final KnowledgeSessionMapper sessionMapper;
    private final MessageMapper messageMapper;
    private final ConversationMapper conversationMapper;
    private final UserMapper userMapper;
    private final RagFeedbackFixService ragFeedbackFixService;
    private final RagFeedbackActionService ragFeedbackActionService;

    @Transactional
    public AiFeedbackVO submit(AiFeedbackCreateRequest request) {
        Long userId = requireUserId();
        validateReason(request.getRating(), request.getReason());
        validateReasonDetail(request.getRating(), request.getReason(), request.getReasonDetail());
        assertRefOwned(userId, request.getRefType(), request.getRefId());

        AiFeedback existing = feedbackMapper.selectOne(
                new LambdaQueryWrapper<AiFeedback>()
                        .eq(AiFeedback::getUserId, userId)
                        .eq(AiFeedback::getRefType, request.getRefType())
                        .eq(AiFeedback::getRefId, request.getRefId())
        );

        LocalDateTime now = LocalDateTime.now();
        if (existing != null) {
            existing.setScene(request.getScene());
            existing.setRating(request.getRating());
            existing.setReason(normalizeReason(request.getRating(), request.getReason()));
            existing.setReasonDetail(normalizeReasonDetail(request.getRating(), request.getReasonDetail()));
            existing.setUpdatedAt(now);
            feedbackMapper.updateById(existing);
            triggerRagAutoFix(existing);
            return toVO(existing);
        }

        AiFeedback row = new AiFeedback();
        row.setUserId(userId);
        row.setScene(request.getScene());
        row.setRefType(request.getRefType());
        row.setRefId(request.getRefId());
        row.setRating(request.getRating());
        row.setReason(normalizeReason(request.getRating(), request.getReason()));
        row.setReasonDetail(normalizeReasonDetail(request.getRating(), request.getReasonDetail()));
        row.setCreatedAt(now);
        row.setUpdatedAt(now);
        feedbackMapper.insert(row);
        triggerRagAutoFix(row);
        return toVO(row);
    }

    private void triggerRagAutoFix(AiFeedback row) {
        if (!"rag".equals(row.getScene()) || !"down".equals(row.getRating())) {
            return;
        }
        if (!"knowledge_turn".equals(row.getRefType())) {
            return;
        }
        ragFeedbackFixService.handleRagDownvoteAsync(
                row.getId(),
                row.getRefId(),
                row.getUserId(),
                row.getReason(),
                row.getReasonDetail()
        );
    }

    /** 批量查询当前用户对 ref 的反馈 rating（up/down），无记录则不在 map 中 */
    public Map<Long, String> getRatingMapForRefs(Long userId, String refType, List<Long> refIds) {
        if (userId == null || refType == null || refType.isBlank() || refIds == null || refIds.isEmpty()) {
            return Map.of();
        }
        List<Long> ids = refIds.stream().filter(id -> id != null && id > 0).distinct().toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        List<AiFeedback> rows = feedbackMapper.selectList(
                new LambdaQueryWrapper<AiFeedback>()
                        .eq(AiFeedback::getUserId, userId)
                        .eq(AiFeedback::getRefType, refType)
                        .in(AiFeedback::getRefId, ids)
        );
        return rows.stream()
                .filter(fb -> fb.getRefId() != null && fb.getRating() != null)
                .collect(Collectors.toMap(AiFeedback::getRefId, AiFeedback::getRating, (a, b) -> b));
    }

    public AiFeedbackStatsVO getStats(int recentLimit) {
        LoginUserContext.requireAdmin();
        int limit = Math.min(Math.max(recentLimit, 1), 100);

        List<AiFeedback> all = feedbackMapper.selectList(new LambdaQueryWrapper<>());
        AiFeedbackStatsVO vo = new AiFeedbackStatsVO();
        for (AiFeedback fb : all) {
            if ("up".equals(fb.getRating())) {
                vo.setUpCount(vo.getUpCount() + 1);
                if ("rag".equals(fb.getScene())) vo.setRagUp(vo.getRagUp() + 1);
                if ("chat".equals(fb.getScene())) vo.setChatUp(vo.getChatUp() + 1);
            } else if ("down".equals(fb.getRating())) {
                vo.setDownCount(vo.getDownCount() + 1);
                if ("rag".equals(fb.getScene())) vo.setRagDown(vo.getRagDown() + 1);
                if ("chat".equals(fb.getScene())) vo.setChatDown(vo.getChatDown() + 1);
            }
        }

        List<AiFeedback> downs = feedbackMapper.selectList(
                new LambdaQueryWrapper<AiFeedback>()
                        .eq(AiFeedback::getRating, "down")
                        .orderByDesc(AiFeedback::getCreatedAt)
                        .last("LIMIT " + limit)
        );

        Map<Long, String> usernames = loadUsernames(downs);
        vo.setRecentDowns(downs.stream().map(fb -> toDownItem(fb, usernames)).collect(Collectors.toList()));
        vo.setRecentRagActions(ragFeedbackActionService.listRecent(limit));
        for (AiFeedbackDownItemVO item : vo.getRecentDowns()) {
            if ("knowledge_turn".equals(item.getRefType())) {
                item.setRagActions(ragFeedbackActionService.listByTurnId(item.getRefId()));
            }
        }
        return vo;
    }

    private Map<Long, String> loadUsernames(List<AiFeedback> rows) {
        Set<Long> userIds = rows.stream().map(AiFeedback::getUserId).collect(Collectors.toSet());
        if (userIds.isEmpty()) {
            return Map.of();
        }
        return userMapper.selectBatchIds(userIds).stream()
                .collect(Collectors.toMap(User::getId, User::getUsername, (a, b) -> a));
    }

    private AiFeedbackDownItemVO toDownItem(AiFeedback fb, Map<Long, String> usernames) {
        AiFeedbackDownItemVO item = new AiFeedbackDownItemVO();
        item.setId(fb.getId());
        item.setUserId(fb.getUserId());
        item.setUsername(usernames.getOrDefault(fb.getUserId(), "—"));
        item.setScene(fb.getScene());
        item.setRefType(fb.getRefType());
        item.setRefId(fb.getRefId());
        item.setReason(fb.getReason());
        item.setReasonDetail(fb.getReasonDetail());
        item.setSummary(buildSummary(fb));
        item.setCreatedAt(fb.getCreatedAt());
        return item;
    }

    private String buildSummary(AiFeedback fb) {
        if ("knowledge_turn".equals(fb.getRefType())) {
            KnowledgeTurn turn = turnMapper.selectById(fb.getRefId());
            if (turn != null && turn.getQuestion() != null) {
                return truncate(turn.getQuestion(), 120);
            }
        }
        if ("message".equals(fb.getRefType())) {
            Message msg = messageMapper.selectById(fb.getRefId());
            if (msg != null && msg.getContent() != null) {
                return truncate(msg.getContent(), 120);
            }
        }
        return "ref#" + fb.getRefId();
    }

    private static String truncate(String text, int max) {
        String t = text.strip();
        return t.length() <= max ? t : t.substring(0, max) + "…";
    }

    private void assertRefOwned(Long userId, String refType, Long refId) {
        if ("knowledge_turn".equals(refType)) {
            KnowledgeTurn turn = turnMapper.selectById(refId);
            if (turn == null) {
                throw new BusinessException(404, "问答记录不存在");
            }
            KnowledgeSession session = sessionMapper.selectById(turn.getSessionId());
            if (session == null || !userId.equals(session.getUserId())) {
                throw new BusinessException(403, "无权反馈该问答");
            }
            return;
        }
        if ("message".equals(refType)) {
            Message msg = messageMapper.selectById(refId);
            if (msg == null) {
                throw new BusinessException(404, "消息不存在");
            }
            if (!"assistant".equals(msg.getRole())) {
                throw new BusinessException(400, "仅可对助手消息反馈");
            }
            Conversation conv = conversationMapper.selectById(msg.getConversationId());
            if (conv == null || !userId.equals(conv.getUserId())) {
                throw new BusinessException(403, "无权反馈该消息");
            }
            return;
        }
        throw new BusinessException(400, "暂不支持的 refType");
    }

    private void validateReason(String rating, String reason) {
        if ("down".equals(rating) && reason != null && !reason.isBlank() && !VALID_REASONS.contains(reason)) {
            throw new BusinessException(400, "reason 无效");
        }
    }

    private void validateReasonDetail(String rating, String reason, String reasonDetail) {
        if (!"down".equals(rating)) {
            return;
        }
        if ("other".equals(reason) && (reasonDetail == null || reasonDetail.isBlank())) {
            throw new BusinessException(400, "选择「其他」时请填写补充说明");
        }
        if (reasonDetail != null && reasonDetail.length() > 512) {
            throw new BusinessException(400, "补充说明不能超过 512 字");
        }
    }

    private String normalizeReason(String rating, String reason) {
        if (!"down".equals(rating) || reason == null || reason.isBlank()) {
            return null;
        }
        return reason.trim();
    }

    private String normalizeReasonDetail(String rating, String reasonDetail) {
        if (!"down".equals(rating) || reasonDetail == null || reasonDetail.isBlank()) {
            return null;
        }
        return reasonDetail.strip();
    }

    private AiFeedbackVO toVO(AiFeedback row) {
        AiFeedbackVO vo = new AiFeedbackVO();
        vo.setId(row.getId());
        vo.setScene(row.getScene());
        vo.setRefType(row.getRefType());
        vo.setRefId(row.getRefId());
        vo.setRating(row.getRating());
        vo.setReason(row.getReason());
        vo.setReasonDetail(row.getReasonDetail());
        vo.setCreatedAt(row.getCreatedAt());
        return vo;
    }

    private Long requireUserId() {
        Long userId = LoginUserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(401, "未登录");
        }
        return userId;
    }
}
