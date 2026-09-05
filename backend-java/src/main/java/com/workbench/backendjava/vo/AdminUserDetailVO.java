package com.workbench.backendjava.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class AdminUserDetailVO {
    private Long id;
    private String username;
    private String email;
    private String avatarUrl;
    private String role;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
