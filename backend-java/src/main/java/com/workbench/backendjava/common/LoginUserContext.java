package com.workbench.backendjava.common;

import com.workbench.backendjava.common.BusinessException;

public final class LoginUserContext {

    private static final ThreadLocal<Long> USER_ID = new ThreadLocal<>();
    private static final ThreadLocal<String> ROLE = new ThreadLocal<>();

    public static void setUserId(Long userId) {
        USER_ID.set(userId);
    }

    public static Long getUserId() {
        return USER_ID.get();
    }

    public static void setRole(String role) {
        ROLE.set(role);
    }

    public static String getRole() {
        return ROLE.get();
    }

    public static void clear() {
        USER_ID.remove();
        ROLE.remove();
    }

    public static void requireAdmin() {
        if (!UserRole.ADMIN.equals(getRole())) {
            throw new BusinessException(403, "需要管理员权限");
        }
    }
}
