package com.workbench.backendjava.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.workbench.backendjava.common.PageResult;
import com.workbench.backendjava.entity.RagFeedbackAction;
import com.workbench.backendjava.mapper.RagFeedbackActionMapper;
import com.workbench.backendjava.vo.RagFeedbackActionVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RagFeedbackActionService {

    private final RagFeedbackActionMapper actionMapper;

    public void logAction(
            Long feedbackId,
            Long turnId,
            Integer triageStep,
            String actionType,
            String detailJson,
            String status
    ) {
        RagFeedbackAction row = new RagFeedbackAction();
        row.setFeedbackId(feedbackId);
        row.setTurnId(turnId);
        row.setTriageStep(triageStep);
        row.setActionType(actionType);
        row.setDetailJson(detailJson);
        row.setStatus(status != null ? status : "success");
        row.setCreatedAt(LocalDateTime.now());
        actionMapper.insert(row);
    }

    public PageResult<RagFeedbackActionVO> listPage(long page, long size) {
        long p = Math.max(page, 1);
        long s = Math.min(Math.max(size, 1), 100);
        Page<RagFeedbackAction> result = actionMapper.selectPage(
                new Page<>(p, s),
                new LambdaQueryWrapper<RagFeedbackAction>()
                        .orderByDesc(RagFeedbackAction::getCreatedAt)
        );
        List<RagFeedbackActionVO> records = result.getRecords().stream()
                .map(this::toVO)
                .collect(Collectors.toList());
        return PageResult.of(records, result.getTotal(), p, s);
    }

    public List<RagFeedbackActionVO> listByTurnId(Long turnId) {
        if (turnId == null) return List.of();
        return actionMapper.selectList(
                new LambdaQueryWrapper<RagFeedbackAction>()
                        .eq(RagFeedbackAction::getTurnId, turnId)
                        .orderByDesc(RagFeedbackAction::getCreatedAt)
        ).stream().map(this::toVO).collect(Collectors.toList());
    }

    public boolean hasRecentReindexForTurnSource(Long turnId, String source, int hours) {
        if (source == null || source.isBlank()) return false;
        LocalDateTime since = LocalDateTime.now().minusHours(hours);
        Long count = actionMapper.selectCount(
                new LambdaQueryWrapper<RagFeedbackAction>()
                        .eq(RagFeedbackAction::getActionType, "reindex")
                        .ge(RagFeedbackAction::getCreatedAt, since)
                        .like(RagFeedbackAction::getDetailJson, source)
        );
        return count != null && count > 0;
    }

    private RagFeedbackActionVO toVO(RagFeedbackAction row) {
        RagFeedbackActionVO vo = new RagFeedbackActionVO();
        vo.setId(row.getId());
        vo.setFeedbackId(row.getFeedbackId());
        vo.setTurnId(row.getTurnId());
        vo.setTriageStep(row.getTriageStep());
        vo.setActionType(row.getActionType());
        vo.setDetailJson(row.getDetailJson());
        vo.setStatus(row.getStatus());
        vo.setCreatedAt(row.getCreatedAt());
        return vo;
    }
}
