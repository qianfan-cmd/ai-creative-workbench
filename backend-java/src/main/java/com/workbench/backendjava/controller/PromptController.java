package com.workbench.backendjava.controller;

import com.workbench.backendjava.common.Result;
import com.workbench.backendjava.dto.PromptTemplateCreateRequest;
import com.workbench.backendjava.dto.PromptTemplateUpdateRequest;
import com.workbench.backendjava.service.PromptTemplateService;
import com.workbench.backendjava.vo.PromptTemplateVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/prompts")
@RequiredArgsConstructor
public class PromptController {

    private final PromptTemplateService promptTemplateService;

    /**
     * 列表，scene可选
     * 不传 scene默认返回所有可见模板
     */
    @GetMapping
    public Result<List<PromptTemplateVO>> list (@RequestParam(required = false) String scene) {
        return Result.ok(promptTemplateService.listTemplates(scene));
    }

    @GetMapping("/{id}")
    public Result<PromptTemplateVO> get(@PathVariable Long id) {
        return Result.ok(promptTemplateService.getTemplate(id));
    }

    @PostMapping
    public Result<PromptTemplateVO> create(@Valid @RequestBody PromptTemplateCreateRequest request) {
        return Result.ok(promptTemplateService.createTemplate(request));
    }

    @PutMapping("/{id}")
    public Result<PromptTemplateVO> update(
            @PathVariable Long id,
            @Valid @RequestBody PromptTemplateUpdateRequest request
    ) {
        return Result.ok(promptTemplateService.updateTemplate(id, request));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        promptTemplateService.deleteTemplate(id);
        return Result.ok(null);
    }
}
