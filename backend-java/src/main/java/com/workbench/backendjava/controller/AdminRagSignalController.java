package com.workbench.backendjava.controller;

import com.workbench.backendjava.common.LoginUserContext;
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
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminRagSignalController {

    private final RagSourceSignalService sourceSignalService;
    private final KnowledgeDocumentService knowledgeDocumentService;

    @GetMapping("/rag/source-signals")
    public Result<List<RagSourceSignalVO>> listSourceSignals() {
        LoginUserContext.requireAdmin();
        List<RagSourceSignalVO> list = sourceSignalService.listActiveSignals().stream()
                .map(this::toVO)
                .collect(Collectors.toList());
        return Result.ok(list);
    }

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

    @PostMapping("/knowledge/reindex-all")
    public Result<KnowledgeReindexAllVO> reindexAll() {
        LoginUserContext.requireAdmin();
        return Result.ok(knowledgeDocumentService.reindexAllDocumentsAdmin());
    }

    private RagSourceSignalVO toVO(RagSourceSignal row) {
        RagSourceSignalVO vo = new RagSourceSignalVO();
        vo.setSource(row.getSource());
        vo.setPenalty(row.getPenalty() != null ? row.getPenalty() : 0);
        vo.setBoost(row.getBoost() != null ? row.getBoost() : 0);
        vo.setUpdatedAt(row.getUpdatedAt());
        return vo;
    }
}
