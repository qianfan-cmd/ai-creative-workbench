package com.workbench.backendjava.controller;

import com.workbench.backendjava.common.Result;
import com.workbench.backendjava.dto.LoginRequest;
import com.workbench.backendjava.dto.RegisterRequest;
import com.workbench.backendjava.service.UserService;
import com.workbench.backendjava.vo.LoginResponse;
import com.workbench.backendjava.vo.UserVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserService userService;

    @PostMapping("/register")
    public Result<UserVO> register(@Valid @RequestBody RegisterRequest request) {
        UserVO user = userService.register(request);
        return Result.ok(user);
    }

    @PostMapping("/login")
    public Result<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        LoginResponse response = userService.login(request);
        return Result.ok(response);
        // 返回的token：
        // eyJhbGciOiJIUzM4NCJ9.eyJzdWIiOiIxIiwidXNlcm5hbWUiOiJ0ZXN0IiwiaWF0IjoxNzg1NDM3ODE5LCJleHAiOjE3ODU1MjQyMTl9.vHYcL04IBhBhrQf966ldbCYVpq74S27cVnZKYZVRKqVrE5sX62HkINQkTdHk2JCG
    }

    /**
     * 登录成功返回用户信息，否则抛出异常
     * @return
     */
    @GetMapping("/me")
    public Result<UserVO> me() {
        UserVO userVO = userService.getCurrentUser();
        return Result.ok(userVO);
    }
}
