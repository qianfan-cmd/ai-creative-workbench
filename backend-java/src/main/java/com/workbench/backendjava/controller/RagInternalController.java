package com.workbench.backendjava.controller;

import com.workbench.backendjava.common.Result;
import com.workbench.backendjava.entity.RagChunkSignal;
import com.workbench.backendjava.entity.RagSourceSignal;
import com.workbench.backendjava.service.RagChunkSignalService;
import com.workbench.backendjava.service.RagSourceSignalService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

/**
 * Python RAG 服务内部回调 — 拉取 Java 侧 chunk/source 反馈信号供 rerank 使用，无需登录（localhost 联调）。
 * 前缀 {@code /api/internal/rag}；调用方：Python {@code chunk_signal_client.py}、{@code source_signal_client.py}。
 */
@RestController
@RequestMapping("/api/internal/rag")
@RequiredArgsConstructor
public class RagInternalController {

    private final RagChunkSignalService chunkSignalService;
    private final RagSourceSignalService sourceSignalService;

    /**
     * {@code GET /api/internal/rag/chunk-signals} — 全量 chunk penalty/boost 信号。
     * 委托 {@link RagChunkSignalService#loadAllAsMap}；Python {@code get_chunk_signals()}。
     */
    @GetMapping("/chunk-signals")
    public Result<Map<String, Map<String, Object>>> chunkSignals() {
        Map<String, RagChunkSignal> rows = chunkSignalService.loadAllAsMap();
        Map<String, Map<String, Object>> out = new HashMap<>();
        for (Map.Entry<String, RagChunkSignal> e : rows.entrySet()) {
            RagChunkSignal row = e.getValue();
            Map<String, Object> item = new HashMap<>();
            item.put("penalty", row.getPenalty() != null ? row.getPenalty() : 0);
            item.put("boost", row.getBoost() != null ? row.getBoost() : 0);
            item.put("source", row.getSource());
            out.put(e.getKey(), item);
        }
        return Result.ok(out);
    }

    /**
     * {@code GET /api/internal/rag/source-signals} — 全量文档源 penalty/boost 信号。
     * 委托 {@link RagSourceSignalService#loadAllAsMap}；Python {@code get_source_signals()}。
     */
    @GetMapping("/source-signals")
    public Result<Map<String, Map<String, Object>>> sourceSignals() {
        Map<String, RagSourceSignal> rows = sourceSignalService.loadAllAsMap();
        Map<String, Map<String, Object>> out = new HashMap<>();
        for (Map.Entry<String, RagSourceSignal> e : rows.entrySet()) {
            RagSourceSignal row = e.getValue();
            Map<String, Object> item = new HashMap<>();
            item.put("penalty", row.getPenalty() != null ? row.getPenalty() : 0);
            item.put("boost", row.getBoost() != null ? row.getBoost() : 0);
            out.put(e.getKey(), item);
        }
        return Result.ok(out);
    }
}
