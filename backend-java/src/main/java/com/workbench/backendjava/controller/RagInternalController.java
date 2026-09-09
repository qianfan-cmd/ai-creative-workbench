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

/** Python RAG 服务内部调用 — 无需登录（仅 localhost 联调）。 */
@RestController
@RequestMapping("/api/internal/rag")
@RequiredArgsConstructor
public class RagInternalController {

    private final RagChunkSignalService chunkSignalService;
    private final RagSourceSignalService sourceSignalService;

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
