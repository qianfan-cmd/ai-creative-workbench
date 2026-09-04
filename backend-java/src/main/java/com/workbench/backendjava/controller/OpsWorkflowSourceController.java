package com.workbench.backendjava.controller;

import com.workbench.backendjava.common.Result;
import com.workbench.backendjava.dto.WorkflowSourceBatchPatchRequest;
import com.workbench.backendjava.dto.WorkflowSourceFromLibraryRequest;
import com.workbench.backendjava.dto.WorkflowSourcePatchRequest;
import com.workbench.backendjava.common.LoginUserContext;
import com.workbench.backendjava.common.BusinessException;
import com.workbench.backendjava.service.WorkflowSourceService;
import com.workbench.backendjava.vo.AssetVO;
import com.workbench.backendjava.vo.WorkflowSourceVO;
import jakarta.validation.Valid;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/ops/workflow-sources")
@RequiredArgsConstructor
public class OpsWorkflowSourceController {

    private final WorkflowSourceService workflowSourceService;

    @GetMapping
    public Result<List<WorkflowSourceVO>> list(
            @RequestParam String context,
            @RequestParam(required = false) Long taskId,
            @RequestParam(required = false) Long draftId) {
        Long userId = requireUserId();
        return Result.ok(workflowSourceService.list(context, taskId, draftId, userId));
    }

    @PostMapping("/upload")
    public Result<WorkflowSourceVO> upload(
            @RequestParam String context,
            @RequestParam(required = false) Long taskId,
            @RequestParam(required = false) Long draftId,
            @RequestParam(value = "ephemeralReference", required = false, defaultValue = "false")
                    boolean ephemeralReference,
            @RequestParam("file") MultipartFile file) {
        Long userId = requireUserId();
        return Result.ok(workflowSourceService.upload(
                context, taskId, draftId, file, userId, ephemeralReference));
    }

    @PostMapping("/from-library")
    public Result<List<WorkflowSourceVO>> fromLibrary(@Valid @RequestBody WorkflowSourceFromLibraryRequest request) {
        Long userId = requireUserId();
        return Result.ok(workflowSourceService.addFromLibrary(request, userId));
    }

    @PatchMapping("/{id}")
    public Result<WorkflowSourceVO> patch(@PathVariable Long id, @RequestBody WorkflowSourcePatchRequest request) {
        Long userId = requireUserId();
        return Result.ok(workflowSourceService.patch(id, request, userId));
    }

    @PatchMapping("/batch")
    public Result<List<WorkflowSourceVO>> batchPatch(@RequestBody WorkflowSourceBatchPatchRequest request) {
        Long userId = requireUserId();
        return Result.ok(workflowSourceService.batchPatch(request, userId));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        Long userId = requireUserId();
        workflowSourceService.delete(id, userId);
        return Result.ok(null);
    }

    @PostMapping("/generate-ai")
    public Result<List<WorkflowSourceVO>> generateAi(@Valid @RequestBody WorkflowSourceGenerateAiBody body) {
        Long userId = requireUserId();
        if (!WorkflowSourceService.CONTEXT_CAMPAIGN.equals(body.getContext())) {
            throw new BusinessException(400, "请使用 matting 任务生图接口");
        }
        return Result.ok(workflowSourceService.generateAiCampaign(
                body.getDraftId(),
                body.getPrompt(),
                body.getReferenceUrls(),
                body.getCount() != null ? body.getCount() : 4,
                body.getAspectRatio(),
                userId));
    }

    @GetMapping("/selected-preview")
    public Result<List<WorkflowSourceVO>> selectedPreview(
            @RequestParam String context,
            @RequestParam(required = false) Long taskId,
            @RequestParam(required = false) Long draftId) {
        Long userId = requireUserId();
        return Result.ok(workflowSourceService.listSelectedVO(context, taskId, draftId, userId));
    }

    @PostMapping("/{id}/import-to-assets")
    public Result<AssetVO> importToAssets(@PathVariable Long id) {
        Long userId = requireUserId();
        return Result.ok(workflowSourceService.importToAssets(id, userId, List.of("generated", "campaign")));
    }

    @Data
    public static class WorkflowSourceGenerateAiBody {
        private String context;
        private Long draftId;
        private String prompt;
        private List<String> referenceUrls;
        private Integer count;
        private String aspectRatio;
    }

    private Long requireUserId() {
        Long userId = LoginUserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(401, "未登录");
        }
        return userId;
    }
}
