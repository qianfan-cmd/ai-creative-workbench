package com.workbench.backendjava.controller;

import com.workbench.backendjava.common.Result;
import com.workbench.backendjava.dto.ChangePasswordRequest;
import com.workbench.backendjava.dto.ForgotPasswordRequest;
import com.workbench.backendjava.dto.LoginRequest;
import com.workbench.backendjava.dto.ProfileUpdateRequest;
import com.workbench.backendjava.dto.RegisterRequest;
import com.workbench.backendjava.dto.ResetPasswordRequest;
import com.workbench.backendjava.service.UserService;
import com.workbench.backendjava.vo.LoginResponse;
import com.workbench.backendjava.vo.UserVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

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
    }

    @GetMapping("/me")
    public Result<UserVO> me() {
        UserVO userVO = userService.getCurrentUser();
        return Result.ok(userVO);
    }

    @PatchMapping("/profile")
    public Result<UserVO> updateProfile(@Valid @RequestBody ProfileUpdateRequest request) {
        return Result.ok(userService.updateProfile(request));
    }

    @PostMapping("/avatar")
    public Result<UserVO> uploadAvatar(@RequestParam("file") MultipartFile file) {
        return Result.ok(userService.updateAvatar(file));
    }

    @PutMapping("/password")
    public Result<Void> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        userService.changePassword(request);
        return Result.ok(null);
    }

    @PostMapping("/forgot-password")
    public Result<Void> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        userService.requestPasswordReset(request.getEmail());
        return Result.ok(null, "若该邮箱已注册，您将收到重置密码邮件");
    }

    @PostMapping("/reset-password")
    public Result<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        userService.resetPassword(request);
        return Result.ok(null, "密码已重置，请使用新密码登录");
    }
}
