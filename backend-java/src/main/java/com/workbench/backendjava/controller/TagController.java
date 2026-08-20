package com.workbench.backendjava.controller;

import com.workbench.backendjava.common.Result;
import com.workbench.backendjava.dto.TagCreateRequest;
import com.workbench.backendjava.dto.TagUpdateRequest;
import com.workbench.backendjava.service.TagService;
import com.workbench.backendjava.vo.TagVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tags")
@RequiredArgsConstructor
public class TagController {

    private final TagService tagService;

    @PostMapping
    public Result<TagVO> create(@Valid @RequestBody TagCreateRequest request) {
        return Result.ok(tagService.create(request));
    }

    @GetMapping
    public Result<List<TagVO>> list() {
        return Result.ok(tagService.list());
    }

    @PutMapping("/{id}")
    public Result<TagVO> update(@PathVariable Long id,
                                @Valid @RequestBody TagUpdateRequest request) {
        return Result.ok(tagService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        tagService.delete(id);
        return Result.ok(null);
    }
}
