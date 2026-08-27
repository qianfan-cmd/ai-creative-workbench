package com.workbench.backendjava.controller;

import com.workbench.backendjava.common.Result;
import com.workbench.backendjava.dto.RagQueryRequest;
import com.workbench.backendjava.service.RagService;
import com.workbench.backendjava.vo.RagQueryVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/rag")
public class RagController {

    private final RagService ragService;

    @PostMapping("/query")
    public Result<RagQueryVO> query(@Valid @RequestBody RagQueryRequest request) {
        return Result.ok(ragService.query(request));
    }
}
