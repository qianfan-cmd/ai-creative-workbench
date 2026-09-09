package com.workbench.backendjava.controller;

import com.workbench.backendjava.common.Result;
import com.workbench.backendjava.dto.AiFeedbackCreateRequest;
import com.workbench.backendjava.service.AiFeedbackService;
import com.workbench.backendjava.vo.AiFeedbackVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/feedback")
@RequiredArgsConstructor
public class FeedbackController {

    private final AiFeedbackService aiFeedbackService;

    /** 提交或更新反馈（同一 user + ref 仅保留最新一条） */
    @PostMapping
    public Result<AiFeedbackVO> submit(@Valid @RequestBody AiFeedbackCreateRequest request) {
        return Result.ok(aiFeedbackService.submit(request));
    }
}
