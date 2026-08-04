package com.workbench.backendjava.common;


/**
 * 用ThreadLocal保存当前请求的userId
 * 每个HTTP请求在独立线程里，互不干扰
 * Interceptor 验完 token 后 setUserId
 * Service 里 getUserId() 就知道是谁
 * 请求结束必须 clear()，否则线程池复用线程时会串数据（生产级必做）
 */
public class LoginUserContext {

    private static final ThreadLocal<Long> USER_ID = new ThreadLocal<>();

    public static void setUserId(Long userId) {
        USER_ID.set(userId);
    }

    public static Long getUserId() {
        return USER_ID.get();
    }

    public static void clear() {
        USER_ID.remove();
    }
}
