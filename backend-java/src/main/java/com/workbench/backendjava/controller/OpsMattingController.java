package com.workbench.backendjava.controller;

import com.workbench.backendjava.common.Result;
import com.workbench.backendjava.dto.MattingCropSaveRequest;
import com.workbench.backendjava.dto.MattingElementsPatchRequest;
import com.workbench.backendjava.dto.MattingElementsSaveRequest;
import com.workbench.backendjava.dto.MattingExtractConfirmRequest;
import com.workbench.backendjava.dto.MattingGenerateRequest;
import com.workbench.backendjava.dto.MattingSaveRequest;
import com.workbench.backendjava.dto.MattingTaskCreateRequest;
import com.workbench.backendjava.dto.MattingTaskPatchRequest;
import com.workbench.backendjava.service.MattingTaskService;
import com.workbench.backendjava.vo.AssetVO;
import com.workbench.backendjava.vo.GenerationJobVO;
import com.workbench.backendjava.vo.MattingCropRegionsVO;
import com.workbench.backendjava.vo.MattingElementsVO;
import com.workbench.backendjava.vo.MattingExtractStatusVO;
import com.workbench.backendjava.vo.MattingTaskVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ops/matting/tasks")
@RequiredArgsConstructor
public class OpsMattingController {

    private final MattingTaskService mattingTaskService;

    @GetMapping
    public Result<List<MattingTaskVO>> list() {
        return Result.ok(mattingTaskService.listTasks());
    }

    @PostMapping
    public Result<MattingTaskVO> create(@Valid @RequestBody MattingTaskCreateRequest request) {
        return Result.ok(mattingTaskService.createTask(request));
    }

    @GetMapping("/{id}")
    public Result<MattingTaskVO> get(@PathVariable Long id) {
        return Result.ok(mattingTaskService.getTask(id));
    }

    @PatchMapping("/{id}")
    public Result<MattingTaskVO> patch(@PathVariable Long id, @RequestBody MattingTaskPatchRequest request) {
        return Result.ok(mattingTaskService.patchTask(id, request));
    }

    @GetMapping("/{id}/crop-regions")
    public Result<MattingCropRegionsVO> getCropRegions(@PathVariable Long id) {
        return Result.ok(mattingTaskService.getCropRegions(id));
    }

    @PutMapping("/{id}/crop-regions")
    public Result<MattingTaskVO> saveCropRegions(@PathVariable Long id, @RequestBody MattingCropSaveRequest request) {
        return Result.ok(mattingTaskService.saveCropRegions(id, request));
    }

    @PostMapping("/{id}/crop/confirm")
    public Result<MattingTaskVO> confirmCrop(@PathVariable Long id) {
        return Result.ok(mattingTaskService.confirmCrop(id));
    }

    @GetMapping("/{id}/elements")
    public Result<MattingElementsVO> getElements(@PathVariable Long id) {
        return Result.ok(mattingTaskService.getElements(id));
    }

    @PatchMapping("/{id}/elements")
    public Result<MattingElementsVO> patchElements(@PathVariable Long id, @RequestBody MattingElementsPatchRequest request) {
        return Result.ok(mattingTaskService.patchElements(id, request));
    }

    @PostMapping("/{id}/elements/re-detect")
    public Result<MattingTaskVO> reDetectRegion(@PathVariable Long id, @RequestParam String regionId) {
        return Result.ok(mattingTaskService.reDetectRegion(id, regionId));
    }

    @PostMapping("/{id}/extract/confirm")
    public Result<MattingTaskVO> confirmExtract(@PathVariable Long id, @RequestBody(required = false) MattingExtractConfirmRequest request) {
        return Result.ok(mattingTaskService.confirmExtract(id, request != null ? request : new MattingExtractConfirmRequest()));
    }

    @GetMapping("/{id}/extract/status")
    public Result<MattingExtractStatusVO> getExtractStatus(@PathVariable Long id) {
        return Result.ok(mattingTaskService.getExtractStatus(id));
    }

    @PostMapping("/{id}/elements/save")
    public Result<List<AssetVO>> saveElements(@PathVariable Long id, @RequestBody MattingElementsSaveRequest request) {
        return Result.ok(mattingTaskService.saveElements(id, request));
    }

    @PostMapping("/{id}/generate")
    public Result<GenerationJobVO> generate(@PathVariable Long id, @RequestBody MattingGenerateRequest request) {
        return Result.ok(mattingTaskService.generate(id, request));
    }

    @PostMapping("/{id}/save")
    public Result<AssetVO> save(@PathVariable Long id, @Valid @RequestBody MattingSaveRequest request) {
        return Result.ok(mattingTaskService.saveToAssets(id, request));
    }

    @GetMapping("/{id}/history")
    public Result<List<GenerationJobVO>> history(@PathVariable Long id) {
        return Result.ok(mattingTaskService.history(id));
    }
}
