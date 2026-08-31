package com.workbench.backendjava.controller;

import com.workbench.backendjava.common.Result;
import com.workbench.backendjava.dto.OpsImageGenerateRequest;
import com.workbench.backendjava.service.OpsImageService;
import com.workbench.backendjava.vo.GenerationJobVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ops/image-gen")
@RequiredArgsConstructor
public class OpsImageController {

    private final OpsImageService opsImageService;

    @PostMapping
    public Result<GenerationJobVO> generate(@Valid @RequestBody OpsImageGenerateRequest request) {
        return Result.ok(opsImageService.generate(request));
    }
}
