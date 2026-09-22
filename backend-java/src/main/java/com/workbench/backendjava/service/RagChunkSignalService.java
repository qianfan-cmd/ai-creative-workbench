package com.workbench.backendjava.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.workbench.backendjava.entity.RagChunkSignal;
import com.workbench.backendjava.mapper.RagChunkSignalMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * RAG chunk 级反馈信号（penalty/boost）持久化。
 * Python rerank（{@code reranker.py}）经 {@link com.workbench.backendjava.controller.RagInternalController}
 * 拉全量信号，按 {@code penalty * PENALTY_WEIGHT} / {@code boost * BOOST_WEIGHT} 调整 Cross-Encoder 分数。
 * {@link #MAX_PENALTY}/{@link #MAX_BOOST} 为单 chunk 累计上/下调上限，防止多次差评过度压制或抬升检索结果。
 * 写入方：{@link RagFeedbackFixService}（用户差评自动修复）。
 */
@Service
@RequiredArgsConstructor
public class RagChunkSignalService {

    /** 单 chunk penalty 累计上限，对应 Python rerank 最大扣分幅度。 */
    private static final int MAX_PENALTY = 5;
    /** 单 chunk boost 累计上限，对应 Python rerank 最大加分幅度。 */
    private static final int MAX_BOOST = 5;

    private final RagChunkSignalMapper signalMapper;

    /**
     * 加载全部 chunk 信号为 map（chunkId → row）。
     * 调用方：{@link com.workbench.backendjava.controller.RagInternalController#chunkSignals}（Python 回调）。
     */
    public Map<String, RagChunkSignal> loadAllAsMap() {
        List<RagChunkSignal> rows = signalMapper.selectList(new LambdaQueryWrapper<>());
        Map<String, RagChunkSignal> map = new HashMap<>();
        for (RagChunkSignal row : rows) {
            if (row.getChunkId() != null) {
                map.put(row.getChunkId(), row);
            }
        }
        return map;
    }

    /** 对指定 chunk 累加 penalty（封顶 {@link #MAX_PENALTY}），不存在则 insert。 */
    @Transactional
    public void addPenalty(String chunkId, String source, int delta) {
        if (chunkId == null || chunkId.isBlank()) return;
        RagChunkSignal row = signalMapper.selectOne(
                new LambdaQueryWrapper<RagChunkSignal>().eq(RagChunkSignal::getChunkId, chunkId)
        );
        if (row == null) {
            row = new RagChunkSignal();
            row.setChunkId(chunkId);
            row.setSource(source);
            row.setPenalty(Math.min(MAX_PENALTY, Math.max(0, delta)));
            row.setBoost(0);
            row.setUpdatedAt(LocalDateTime.now());
            signalMapper.insert(row);
            return;
        }
        row.setPenalty(Math.min(MAX_PENALTY, Math.max(0, (row.getPenalty() != null ? row.getPenalty() : 0) + delta)));
        row.setUpdatedAt(LocalDateTime.now());
        signalMapper.updateById(row);
    }

    /** 对指定 chunk 累加 boost（封顶 {@link #MAX_BOOST}），不存在则 insert。 */
    @Transactional
    public void addBoost(String chunkId, String source, int delta) {
        if (chunkId == null || chunkId.isBlank()) return;
        RagChunkSignal row = signalMapper.selectOne(
                new LambdaQueryWrapper<RagChunkSignal>().eq(RagChunkSignal::getChunkId, chunkId)
        );
        if (row == null) {
            row = new RagChunkSignal();
            row.setChunkId(chunkId);
            row.setSource(source);
            row.setPenalty(0);
            row.setBoost(Math.min(MAX_BOOST, Math.max(0, delta)));
            row.setUpdatedAt(LocalDateTime.now());
            signalMapper.insert(row);
            return;
        }
        row.setBoost(Math.min(MAX_BOOST, Math.max(0, (row.getBoost() != null ? row.getBoost() : 0) + delta)));
        row.setUpdatedAt(LocalDateTime.now());
        signalMapper.updateById(row);
    }
}
