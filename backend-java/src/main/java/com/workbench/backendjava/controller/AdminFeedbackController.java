package com.workbench.backendjava.controller;

import com.workbench.backendjava.common.Result;
import com.workbench.backendjava.service.AiFeedbackService;
import com.workbench.backendjava.vo.AiFeedbackStatsVO;
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

    @GetMapping("/stats")
    public Result<AiFeedbackStatsVO> stats(
            @RequestParam(defaultValue = "20") int recentLimit
    ) {
        return Result.ok(aiFeedbackService.getStats(recentLimit));
    }
}
