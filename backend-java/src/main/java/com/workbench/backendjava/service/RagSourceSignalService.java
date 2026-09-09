package com.workbench.backendjava.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.workbench.backendjava.entity.RagSourceSignal;
import com.workbench.backendjava.mapper.RagSourceSignalMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class RagSourceSignalService {

    private static final int MAX_PENALTY = 5;
    private static final int MAX_BOOST = 5;

    private final RagSourceSignalMapper signalMapper;

    public Map<String, RagSourceSignal> loadAllAsMap() {
        List<RagSourceSignal> rows = signalMapper.selectList(new LambdaQueryWrapper<>());
        Map<String, RagSourceSignal> map = new HashMap<>();
        for (RagSourceSignal row : rows) {
            if (row.getSource() != null && !row.getSource().isBlank()) {
                map.put(row.getSource(), row);
            }
        }
        return map;
    }

    public List<RagSourceSignal> listActiveSignals() {
        return signalMapper.selectList(
                new LambdaQueryWrapper<RagSourceSignal>()
                        .and(w -> w.gt(RagSourceSignal::getPenalty, 0).or().gt(RagSourceSignal::getBoost, 0))
                        .orderByDesc(RagSourceSignal::getUpdatedAt)
        );
    }

    @Transactional
    public void clearPenalty(String source) {
        if (source == null || source.isBlank()) return;
        RagSourceSignal row = signalMapper.selectById(source);
        if (row == null) return;
        row.setPenalty(0);
        row.setUpdatedAt(LocalDateTime.now());
        if (intOrZero(row.getBoost()) <= 0) {
            signalMapper.deleteById(source);
        } else {
            signalMapper.updateById(row);
        }
    }

    @Transactional
    public void clearBoost(String source) {
        if (source == null || source.isBlank()) return;
        RagSourceSignal row = signalMapper.selectById(source);
        if (row == null) return;
        row.setBoost(0);
        row.setUpdatedAt(LocalDateTime.now());
        if (intOrZero(row.getPenalty()) <= 0) {
            signalMapper.deleteById(source);
        } else {
            signalMapper.updateById(row);
        }
    }

    @Transactional
    public void clearAll(String source) {
        if (source == null || source.isBlank()) return;
        signalMapper.deleteById(source);
    }

    private static int intOrZero(Integer value) {
        return value != null ? value : 0;
    }

    @Transactional
    public void addSourcePenalty(String source, int delta) {
        if (source == null || source.isBlank()) return;
        RagSourceSignal row = signalMapper.selectById(source);
        if (row == null) {
            row = new RagSourceSignal();
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
    public void addSourceBoost(String source, int delta) {
        if (source == null || source.isBlank()) return;
        RagSourceSignal row = signalMapper.selectById(source);
        if (row == null) {
            row = new RagSourceSignal();
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
