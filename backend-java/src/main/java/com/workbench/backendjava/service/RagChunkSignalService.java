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

@Service
@RequiredArgsConstructor
public class RagChunkSignalService {

    private static final int MAX_PENALTY = 5;
    private static final int MAX_BOOST = 5;

    private final RagChunkSignalMapper signalMapper;

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
