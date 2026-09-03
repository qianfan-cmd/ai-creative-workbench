package com.workbench.backendjava.controller;

import com.workbench.backendjava.common.Result;
import com.workbench.backendjava.dto.CampaignCopySaveRequest;
import com.workbench.backendjava.dto.CampaignDraftCreateRequest;
import com.workbench.backendjava.dto.CampaignDraftMetaRequest;
import com.workbench.backendjava.dto.CampaignDraftPatchRequest;
import com.workbench.backendjava.dto.CampaignGenerateCopyRequest;
import com.workbench.backendjava.dto.CampaignGenerateImagesRequest;
import com.workbench.backendjava.dto.CampaignImagesSaveRequest;
import com.workbench.backendjava.service.CampaignDraftService;
import com.workbench.backendjava.vo.CampaignDraftListItemVO;
import com.workbench.backendjava.vo.CampaignDraftVO;
import com.workbench.backendjava.vo.GenerationJobVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

@RestController
@RequestMapping("/api/ops/campaign")
@RequiredArgsConstructor
public class OpsCampaignController {

    private final CampaignDraftService campaignDraftService;

    @GetMapping("/drafts")
    public Result<List<CampaignDraftListItemVO>> listDrafts() {
        return Result.ok(campaignDraftService.listDrafts());
    }

    /** 创建活动帖草稿 — Phase 1 入口 */
    @PostMapping("/draft")
    public Result<CampaignDraftVO> createDraft(@Valid @RequestBody CampaignDraftCreateRequest request) {
        return Result.ok(campaignDraftService.createDraft(request));
    }

    @GetMapping("/{id}")
    public Result<CampaignDraftVO> getDraft(@PathVariable Long id) {
        return Result.ok(campaignDraftService.getDraft(id));
    }

    /** 保存左栏表单 — 更新 activity_json 与 title */
    @PutMapping("/{id}")
    public Result<CampaignDraftVO> updateDraft(
            @PathVariable Long id,
            @Valid @RequestBody CampaignDraftCreateRequest request
    ) {
        return Result.ok(campaignDraftService.updateDraft(id, request));
    }

    @PatchMapping("/{id}")
    public Result<CampaignDraftVO> patchDraft(
            @PathVariable Long id,
            @Valid @RequestBody CampaignDraftPatchRequest request
    ) {
        return Result.ok(campaignDraftService.patchDraft(id, request));
    }

    @PutMapping("/{id}/meta")
    public Result<CampaignDraftVO> saveMeta(
            @PathVariable Long id,
            @RequestBody CampaignDraftMetaRequest request
    ) {
        return Result.ok(campaignDraftService.saveActivityMeta(id, request));
    }

    @DeleteMapping("/{id}")
    public Result<Void> deleteDraft(@PathVariable Long id) {
        campaignDraftService.deleteDraft(id);
        return Result.ok(null);
    }

    @PostMapping(value = "/{id}/generate-copy", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter generateCopy(
            @PathVariable Long id,
            @Valid @RequestBody CampaignGenerateCopyRequest request
    ) {
        return campaignDraftService.streamGenerateCopy(id, request);
    }

    /** 保存文案 Tab 定稿内容 — 在 generate-copy SSE 结束后调用 */
    @PutMapping("/{id}/copy")
    public Result<CampaignDraftVO> saveCopy(
            @PathVariable Long id,
            @Valid @RequestBody CampaignCopySaveRequest request
    ) {
        return Result.ok(campaignDraftService.saveCopy(id, request));
    }

    @PostMapping("/{id}/generate-images")
    public Result<GenerationJobVO> generateImages(
            @PathVariable Long id,
            @RequestBody CampaignGenerateImagesRequest request
    ) {
        return Result.ok(campaignDraftService.generateImages(id, request));
    }

    @PutMapping("/{id}/images")
    public Result<CampaignDraftVO> saveImages(
            @PathVariable Long id,
            @RequestBody CampaignImagesSaveRequest request
    ) {
        return Result.ok(campaignDraftService.saveImages(id, request));
    }

    @GetMapping("/{id}/export")
    public ResponseEntity<byte[]> export(@PathVariable Long id) {
        byte[] zip = campaignDraftService.exportDraft(id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=campaign-draft.zip")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(zip);
    }
}