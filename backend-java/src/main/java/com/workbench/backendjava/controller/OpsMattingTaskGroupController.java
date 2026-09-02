package com.workbench.backendjava.controller;

import com.workbench.backendjava.common.Result;
import com.workbench.backendjava.dto.MattingTaskGroupCreateRequest;
import com.workbench.backendjava.dto.MattingTaskGroupPatchRequest;
import com.workbench.backendjava.service.MattingTaskGroupService;
import com.workbench.backendjava.service.MattingTaskService;
import com.workbench.backendjava.vo.MattingSidebarVO;
import com.workbench.backendjava.vo.MattingTaskGroupVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ops/matting/task-groups")
@RequiredArgsConstructor
public class OpsMattingTaskGroupController {

    private final MattingTaskGroupService mattingTaskGroupService;
    private final MattingTaskService mattingTaskService;

    @GetMapping
    public Result<MattingSidebarVO> sidebar() {
        return Result.ok(mattingTaskService.getSidebar());
    }

    @GetMapping("/list")
    public Result<List<MattingTaskGroupVO>> list() {
        return Result.ok(mattingTaskGroupService.listGroups());
    }

    @PostMapping
    public Result<MattingTaskGroupVO> create(@Valid @RequestBody MattingTaskGroupCreateRequest request) {
        return Result.ok(mattingTaskGroupService.createGroup(request));
    }

    @PatchMapping("/{id}")
    public Result<MattingTaskGroupVO> patch(
            @PathVariable Long id,
            @RequestBody MattingTaskGroupPatchRequest request) {
        return Result.ok(mattingTaskGroupService.patchGroup(id, request));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        mattingTaskGroupService.deleteGroup(id);
        return Result.ok(null);
    }
}
