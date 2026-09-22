package com.workbench.backendjava.controller;



import com.workbench.backendjava.common.PageResult;

import com.workbench.backendjava.common.Result;

import com.workbench.backendjava.dto.IdsBatchDeleteRequest;

import com.workbench.backendjava.dto.KnowledgeDocumentContentUpdateRequest;

import com.workbench.backendjava.dto.KnowledgeDocumentPatchRequest;

import com.workbench.backendjava.dto.KnowledgeDocumentTagsUpdateRequest;

import com.workbench.backendjava.dto.KnowledgeSessionPatchRequest;

import com.workbench.backendjava.dto.KnowledgeTurnCreateRequest;

import com.workbench.backendjava.service.KnowledgeDocumentTagService;

import com.workbench.backendjava.service.KnowledgeService;

import com.workbench.backendjava.service.KnowledgeSessionService;

import com.workbench.backendjava.vo.TagVO;

import com.workbench.backendjava.vo.KnowledgeBatchDeleteVO;

import com.workbench.backendjava.vo.KnowledgeBatchUploadVO;

import com.workbench.backendjava.vo.KnowledgeDocumentContentVO;

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



/**

 * 知识库 REST API：文档 CRUD/上传、标签、历史会话与 turn 持久化。

 * 前缀 {@code /api/knowledge}；前端 {@code frontend/src/api/knowledge.ts}。

 */

@RestController

@RequestMapping("/api/knowledge")

@RequiredArgsConstructor

public class KnowledgeController {



    private final KnowledgeService knowledgeService;

    private final KnowledgeSessionService knowledgeSessionService;

    private final KnowledgeDocumentTagService knowledgeDocumentTagService;



    /**

     * {@code POST /api/knowledge/upload} — 单文件上传（旧接口，兼容保留）。

     * 委托 {@link KnowledgeService#upload}；前端现多用 {@code uploadKnowledgeDocumentsApi}。

     */

    @PostMapping("/upload")

    public Result<KnowledgeUploadVO> upload(@RequestParam("file") MultipartFile file) {

        return Result.ok(knowledgeService.upload(file));

    }



    /**

     * {@code POST /api/knowledge/documents/upload} — 批量上传文档。

     * 委托 {@link KnowledgeService#uploadDocumentsBatch}；前端 {@code uploadKnowledgeDocumentsApi}。

     */

    @PostMapping("/documents/upload")

    public Result<KnowledgeBatchUploadVO> uploadDocuments(@RequestParam("files") MultipartFile[] files) {

        return Result.ok(knowledgeService.uploadDocumentsBatch(files));

    }



    /**

     * {@code GET /api/knowledge/documents} — 文档库分页列表。

     * 委托 {@link KnowledgeService#listDocumentsPage}；前端 {@code listKnowledgeDocumentsPageApi}。

     */

    @GetMapping("/documents")

    public Result<PageResult<KnowledgeDocumentVO>> listDocuments(

            @RequestParam(defaultValue = "1") Long page,

            @RequestParam(defaultValue = "10") Long size,

            @RequestParam(required = false) String keyword,

            @RequestParam(required = false) String sort) {

        return Result.ok(knowledgeService.listDocumentsPage(page, size, keyword, sort));

    }



    /**

     * {@code GET /api/knowledge/documents/recent} — 侧栏最近文档。

     * 委托 {@link KnowledgeService#listRecentDocuments}；前端 {@code listRecentKnowledgeDocumentsApi}。

     */

    @GetMapping("/documents/recent")

    public Result<List<KnowledgeDocumentVO>> listRecentDocuments(

            @RequestParam(defaultValue = "50") int limit) {

        return Result.ok(knowledgeService.listRecentDocuments(limit));

    }



    /**

     * {@code PATCH /api/knowledge/documents/{id}} — 重命名文档。

     * 委托 {@link KnowledgeService#patchDocument}；前端 {@code patchKnowledgeDocumentApi}。

     */

    @PatchMapping("/documents/{id}")

    public Result<KnowledgeDocumentVO> patchDocument(

            @PathVariable Long id,

            @RequestBody KnowledgeDocumentPatchRequest request) {

        return Result.ok(knowledgeService.patchDocument(id, request));

    }



    /**

     * {@code DELETE /api/knowledge/documents/{id}} — 删除单篇文档。

     * 委托 {@link KnowledgeService#deleteDocument}；前端 {@code deleteKnowledgeDocumentApi}。

     */

    @DeleteMapping("/documents/{id}")

    public Result<Void> deleteDocument(@PathVariable Long id) {

        knowledgeService.deleteDocument(id);

        return Result.ok(null);

    }



    /**

     * {@code POST /api/knowledge/documents/batch-delete} — 批量删除文档。

     * 委托 {@link KnowledgeService#deleteDocumentsBatch}；前端 {@code batchDeleteKnowledgeDocumentsApi}。

     */

    @PostMapping("/documents/batch-delete")

    public Result<KnowledgeBatchDeleteVO> batchDeleteDocuments(@Valid @RequestBody IdsBatchDeleteRequest request) {

        return Result.ok(knowledgeService.deleteDocumentsBatch(request));

    }



    /**

     * {@code GET /api/knowledge/documents/{id}/content} — 读取文档正文。

     * 委托 {@link KnowledgeService#getDocumentContent}；前端 {@code getKnowledgeDocumentContentApi}。

     */

    @GetMapping("/documents/{id}/content")

    public Result<KnowledgeDocumentContentVO> getDocumentContent(@PathVariable Long id) {

        return Result.ok(knowledgeService.getDocumentContent(id));

    }



    /**

     * {@code GET /api/knowledge/documents/{id}/tags} — 查询文档标签。

     * 委托 {@link KnowledgeDocumentTagService#listTagsForDocument}；前端 {@code getKnowledgeDocumentTagsApi}。

     */

    @GetMapping("/documents/{id}/tags")

    public Result<List<TagVO>> getDocumentTags(@PathVariable Long id) {

        return Result.ok(knowledgeDocumentTagService.listTagsForDocument(id));

    }



    /**

     * {@code PUT /api/knowledge/documents/{id}/tags} — 全量替换文档标签。

     * 委托 {@link KnowledgeDocumentTagService#replaceUserTags}；前端 {@code updateKnowledgeDocumentTagsApi}。

     */

    @PutMapping("/documents/{id}/tags")

    public Result<List<TagVO>> updateDocumentTags(

            @PathVariable Long id,

            @Valid @RequestBody KnowledgeDocumentTagsUpdateRequest request

    ) {

        return Result.ok(knowledgeDocumentTagService.replaceUserTags(id, request.getTagIds()));

    }



    /**

     * {@code PUT /api/knowledge/documents/{id}/content} — 在线编辑 txt/md 正文。

     * 委托 {@link KnowledgeService#saveDocumentContent}；前端 {@code saveKnowledgeDocumentContentApi}。

     */

    @PutMapping("/documents/{id}/content")

    public Result<KnowledgeDocumentVO> saveDocumentContent(

            @PathVariable Long id,

            @Valid @RequestBody KnowledgeDocumentContentUpdateRequest request) {

        return Result.ok(knowledgeService.saveDocumentContent(id, request.getContent()));

    }



    /**

     * {@code GET /api/knowledge/sessions} — 历史问答侧栏列表。

     * 委托 {@link KnowledgeSessionService#listSessions}；前端 {@code listKnowledgeSessionsApi}。

     */

    @GetMapping("/sessions")

    public Result<List<KnowledgeSessionVO>> listSessions() {

        return Result.ok(knowledgeSessionService.listSessions());

    }



    /**

     * {@code POST /api/knowledge/sessions} — 新建空会话（点「新问答」）。

     * 委托 {@link KnowledgeSessionService#createSession}；前端 {@code createKnowledgeSessionApi}。

     */

    @PostMapping("/sessions")

    public Result<KnowledgeSessionVO> createSession() {

        return Result.ok(knowledgeSessionService.createSession());

    }



    /**

     * {@code GET /api/knowledge/sessions/{id}} — 切换历史会话，加载完整线程。

     * 委托 {@link KnowledgeSessionService#getSessionDetail}；前端 {@code getKnowledgeSessionApi}。

     */

    @GetMapping("/sessions/{id}")

    public Result<KnowledgeSessionDetailVO> getSession(@PathVariable Long id) {

        return Result.ok(knowledgeSessionService.getSessionDetail(id));

    }



    /**

     * {@code POST /api/knowledge/sessions/{id}/turns} — 流式结束后写入一轮 Q/A。

     * 委托 {@link KnowledgeSessionService#addTurn}；前端 {@code saveKnowledgeTurnApi}。

     */

    @PostMapping("/sessions/{id}/turns")

    public Result<KnowledgeTurnVO> addTurn(

            @PathVariable Long id,

            @Valid @RequestBody KnowledgeTurnCreateRequest request

    ) {

        return Result.ok(knowledgeSessionService.addTurn(id, request));

    }



    /**

     * {@code PUT /api/knowledge/sessions/{sessionId}/turns/{turnId}} — 重新生成后更新已有 turn。

     * 委托 {@link KnowledgeSessionService#updateTurn}；前端 {@code updateKnowledgeTurnApi}。

     */

    @PutMapping("/sessions/{sessionId}/turns/{turnId}")

    public Result<KnowledgeTurnVO> updateTurn(

            @PathVariable Long sessionId,

            @PathVariable Long turnId,

            @Valid @RequestBody KnowledgeTurnCreateRequest request

    ) {

        return Result.ok(knowledgeSessionService.updateTurn(sessionId, turnId, request));

    }



    /**

     * {@code DELETE /api/knowledge/sessions/{id}} — 删除历史会话。

     * 委托 {@link KnowledgeSessionService#deleteSession}；前端 {@code deleteKnowledgeSessionApi}。

     */

    @DeleteMapping("/sessions/{id}")

    public Result<Void> deleteSession(@PathVariable Long id) {

        knowledgeSessionService.deleteSession(id);

        return Result.ok(null);

    }



    /**

     * {@code PATCH /api/knowledge/sessions/{id}} — 更新会话标题或置顶。

     * 委托 {@link KnowledgeSessionService#patchSession}；前端 {@code patchKnowledgeSessionApi}。

     */

    @PatchMapping("/sessions/{id}")

    public Result<KnowledgeSessionVO> patchSession(

            @PathVariable Long id,

            @RequestBody KnowledgeSessionPatchRequest request

    ) {

        return Result.ok(knowledgeSessionService.patchSession(id, request));

    }

}

