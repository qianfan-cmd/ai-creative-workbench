package com.workbench.backendjava.controller;

import com.workbench.backendjava.common.Result;
import com.workbench.backendjava.dto.RagQueryRequest;
import com.workbench.backendjava.service.RagService;
import com.workbench.backendjava.vo.RagQueryVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * RAG 问答 API：同步与 SSE 流式查询，转发 Python 检索 + 生成。
 * 前缀 {@code /api/rag}；前端 {@code ragStreamApi}（流式，{@code frontend/src/api/knowledge.ts}）。
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/rag")
public class RagController {

    private final RagService ragService;

    /**
     * {@code POST /api/rag/query} — 同步 RAG 问答（一次性返回 answer + references）。
     * 委托 {@link RagService#query}；前端暂无独立封装，知识库页主要用流式接口。
     */
    @PostMapping("/query")
    public Result<RagQueryVO> query(@Valid @RequestBody RagQueryRequest request) {
        return Result.ok(ragService.query(request));
    }

    /**
     * {@code POST /api/rag/query/stream} — SSE 流式 RAG 问答（先 references 再 answer 增量）。
     * 委托 {@link RagService#streamQuery}；前端 {@code ragStreamApi}。
     */
    @PostMapping(value = "/query/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter queryStream(@Valid @RequestBody RagQueryRequest request) {
        return ragService.streamQuery(request);
    }
}
