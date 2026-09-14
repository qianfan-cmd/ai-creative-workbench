package com.workbench.backendjava.controller;

import com.workbench.backendjava.common.PageResult;
import com.workbench.backendjava.common.Result;
import com.workbench.backendjava.service.AiFeedbackService;
import com.workbench.backendjava.service.RagFeedbackActionService;
import com.workbench.backendjava.vo.AiFeedbackDownItemVO;
import com.workbench.backendjava.vo.AiFeedbackStatsVO;
import com.workbench.backendjava.vo.RagFeedbackActionVO;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/feedback")
@RequiredArgsConstructor
public class AdminFeedbackController {

    private final AiFeedbackService aiFeedbackService;
    private final RagFeedbackActionService ragFeedbackActionService;

    @GetMapping("/stats")
    public Result<AiFeedbackStatsVO> stats() {
        return Result.ok(aiFeedbackService.getStatsSummary());
    }

    @GetMapping("/downs")
    public Result<PageResult<AiFeedbackDownItemVO>> downs(
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "20") long size,
            @RequestParam(required = false) String scene,
            @RequestParam(required = false) String reason
    ) {
        return Result.ok(aiFeedbackService.listDownsPage(page, size, scene, reason));
    }

    @GetMapping("/rag-actions")
    public Result<PageResult<RagFeedbackActionVO>> ragActions(
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "20") long size
    ) {
        return Result.ok(ragFeedbackActionService.listPage(page, size));
    }
}
