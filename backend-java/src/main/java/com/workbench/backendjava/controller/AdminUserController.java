package com.workbench.backendjava.controller;

import com.workbench.backendjava.common.PageResult;
import com.workbench.backendjava.common.Result;
import com.workbench.backendjava.dto.AdminUserCreateRequest;
import com.workbench.backendjava.dto.AdminUserUpdateRequest;
import com.workbench.backendjava.service.AdminUserService;
import com.workbench.backendjava.vo.AdminUserDetailVO;
import com.workbench.backendjava.vo.AdminUserListItemVO;
import com.workbench.backendjava.vo.UserUsageSummaryVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
public class AdminUserController {

    private final AdminUserService adminUserService;

    @GetMapping
    public Result<PageResult<AdminUserListItemVO>> list(
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "20") long size,
            @RequestParam(required = false) String keyword
    ) {
        return Result.ok(adminUserService.listUsers(page, size, keyword));
    }

    @GetMapping("/{id}")
    public Result<AdminUserDetailVO> get(@PathVariable Long id) {
        return Result.ok(adminUserService.getUser(id));
    }

    @PostMapping
    public Result<AdminUserDetailVO> create(@Valid @RequestBody AdminUserCreateRequest request) {
        return Result.ok(adminUserService.createUser(request));
    }

    @PatchMapping("/{id}")
    public Result<AdminUserDetailVO> update(
            @PathVariable Long id,
            @Valid @RequestBody AdminUserUpdateRequest request
    ) {
        return Result.ok(adminUserService.updateUser(id, request));
    }

    @DeleteMapping("/{id}")
    public Result<Void> disable(@PathVariable Long id) {
        adminUserService.disableUser(id);
        return Result.ok(null, "用户已禁用");
    }

    @GetMapping("/{id}/usage")
    public Result<UserUsageSummaryVO> usage(
            @PathVariable Long id,
            @RequestParam(defaultValue = "30") int days
    ) {
        return Result.ok(adminUserService.getUserUsage(id, days));
    }
}
