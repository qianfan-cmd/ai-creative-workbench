package com.workbench.backendjava.controller;

import com.workbench.backendjava.common.Result;
import com.workbench.backendjava.dto.KnowledgeSessionPatchRequest;
import com.workbench.backendjava.dto.KnowledgeTurnCreateRequest;
import com.workbench.backendjava.service.KnowledgeService;
import com.workbench.backendjava.service.KnowledgeSessionService;
import com.workbench.backendjava.vo.KnowledgeDocumentVO;
import com.workbench.backendjava.vo.KnowledgeSessionDetailVO;
import com.workbench.backendjava.vo.KnowledgeSessionVO;
import com.workbench.backendjava.vo.KnowledgeTurnVO;
import com.workbench.backendjava.vo.KnowledgeUploadVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/knowledge")
@RequiredArgsConstructor
public class KnowledgeController {

    private final KnowledgeService knowledgeService;
    private final KnowledgeSessionService knowledgeSessionService;

    @PostMapping("/upload")
    public Result<KnowledgeUploadVO> upload(@RequestParam("file") MultipartFile file) {
        return Result.ok(knowledgeService.upload(file));
    }

    @GetMapping("/documents")
    public Result<List<KnowledgeDocumentVO>> listDocuments() {
        return Result.ok(knowledgeService.listDocuments());
    }

    /** 历史问答侧栏列表 */
    @GetMapping("/sessions")
    public Result<List<KnowledgeSessionVO>> listSessions() {
        return Result.ok(knowledgeSessionService.listSessions());
    }

    /** 新建空会话（点「新问答」） */
    @PostMapping("/sessions")
    public Result<KnowledgeSessionVO> createSession() {
        return Result.ok(knowledgeSessionService.createSession());
    }

    /** 切换历史会话 — 加载完整线程 */
    @GetMapping("/sessions/{id}")
    public Result<KnowledgeSessionDetailVO> getSession(@PathVariable Long id) {
        return Result.ok(knowledgeSessionService.getSessionDetail(id));
    }

    /** 流式结束后写入一轮 Q/A */
    @PostMapping("/sessions/{id}/turns")
    public Result<KnowledgeTurnVO> addTurn(
            @PathVariable Long id,
            @Valid @RequestBody KnowledgeTurnCreateRequest request
    ) {
        return Result.ok(knowledgeSessionService.addTurn(id, request));
    }

    /** 重新生成后更新已有 turn */
    @PutMapping("/sessions/{sessionId}/turns/{turnId}")
    public Result<KnowledgeTurnVO> updateTurn(
            @PathVariable Long sessionId,
            @PathVariable Long turnId,
            @Valid @RequestBody KnowledgeTurnCreateRequest request
    ) {
        return Result.ok(knowledgeSessionService.updateTurn(sessionId, turnId, request));
    }

    @DeleteMapping("/sessions/{id}")
    public Result<Void> deleteSession(@PathVariable Long id) {
        knowledgeSessionService.deleteSession(id);
        return Result.ok(null);
    }

    @PatchMapping("/sessions/{id}")
    public Result<KnowledgeSessionVO> patchSession(
            @PathVariable Long id,
            @RequestBody KnowledgeSessionPatchRequest request
    ) {
        return Result.ok(knowledgeSessionService.patchSession(id, request));
    }
}
