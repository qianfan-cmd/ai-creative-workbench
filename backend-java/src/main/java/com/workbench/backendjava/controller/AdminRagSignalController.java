package com.workbench.backendjava.controller;



import com.workbench.backendjava.common.LoginUserContext;

import com.workbench.backendjava.common.PageResult;

import com.workbench.backendjava.common.Result;

import com.workbench.backendjava.dto.RagSourceSignalClearRequest;

import com.workbench.backendjava.entity.RagSourceSignal;

import com.workbench.backendjava.service.KnowledgeDocumentService;

import com.workbench.backendjava.service.RagSourceSignalService;

import com.workbench.backendjava.vo.KnowledgeReindexAllVO;

import com.workbench.backendjava.vo.RagSourceSignalVO;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

import org.springframework.web.bind.annotation.GetMapping;

import org.springframework.web.bind.annotation.PostMapping;

import org.springframework.web.bind.annotation.RequestBody;

import org.springframework.web.bind.annotation.RequestMapping;

import org.springframework.web.bind.annotation.RequestParam;

import org.springframework.web.bind.annotation.RestController;



/**

 * Admin RAG 运维 API：source 反馈信号查看/清零、全库向量重建。

 * 前缀 {@code /api/admin}；前端 {@code frontend/src/api/adminFeedback.ts}（需 admin 角色）。

 */

@RestController

@RequestMapping("/api/admin")

@RequiredArgsConstructor

public class AdminRagSignalController {



    private final RagSourceSignalService sourceSignalService;

    private final KnowledgeDocumentService knowledgeDocumentService;



    /**

     * {@code GET /api/admin/rag/source-signals} — 分页列出活跃 source 信号。

     * 委托 {@link RagSourceSignalService#listActiveSignalsPage}；前端 {@code listSourceSignalsApi}。

     */

    @GetMapping("/rag/source-signals")

    public Result<PageResult<RagSourceSignalVO>> listSourceSignals(

            @RequestParam(defaultValue = "1") long page,

            @RequestParam(defaultValue = "20") long size

    ) {

        LoginUserContext.requireAdmin();

        PageResult<RagSourceSignal> pageResult = sourceSignalService.listActiveSignalsPage(page, size);

        PageResult<RagSourceSignalVO> voPage = PageResult.of(

                pageResult.getRecords().stream().map(this::toVO).toList(),

                pageResult.getTotal(),

                pageResult.getPage(),

                pageResult.getSize()

        );

        return Result.ok(voPage);

    }



    /**

     * {@code POST /api/admin/rag/source-signals/clear} — 清零指定 source 的 penalty/boost/all。

     * 委托 {@link RagSourceSignalService}；前端 {@code clearSourceSignalApi}。

     */

    @PostMapping("/rag/source-signals/clear")

    public Result<Void> clearSourceSignal(@Valid @RequestBody RagSourceSignalClearRequest request) {

        LoginUserContext.requireAdmin();

        String field = request.getField();

        if ("penalty".equals(field)) {

            sourceSignalService.clearPenalty(request.getSource());

        } else if ("boost".equals(field)) {

            sourceSignalService.clearBoost(request.getSource());

        } else {

            sourceSignalService.clearAll(request.getSource());

        }

        return Result.ok(null);

    }



    /**

     * {@code POST /api/admin/knowledge/reindex-all} — 全库重建向量索引（embedding 策略升级后执行）。

     * 委托 {@link KnowledgeDocumentService#reindexAllDocumentsAdmin}；前端 {@code reindexAllKnowledgeApi}。

     */

    @PostMapping("/knowledge/reindex-all")

    public Result<KnowledgeReindexAllVO> reindexAll() {

        LoginUserContext.requireAdmin();

        return Result.ok(knowledgeDocumentService.reindexAllDocumentsAdmin());

    }



    /** Entity → Admin 页展示的 source 信号 VO。 */

    private RagSourceSignalVO toVO(RagSourceSignal row) {

        RagSourceSignalVO vo = new RagSourceSignalVO();

        vo.setSource(row.getSource());

        vo.setPenalty(row.getPenalty() != null ? row.getPenalty() : 0);

        vo.setBoost(row.getBoost() != null ? row.getBoost() : 0);

        vo.setUpdatedAt(row.getUpdatedAt());

        return vo;

    }

}

