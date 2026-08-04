package com.workbench.backendjava.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@RequiredArgsConstructor
public class WebMvcConfig implements WebMvcConfigurer {

    private final AuthInterceptor authInterceptor;

    /**
     * 以后新增的一些必须登录的接口都可以自动被拦截检验
     * @param registry
     */
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(authInterceptor)
                .addPathPatterns("/api/**")          // 拦截所有 /api 接口
                .excludePathPatterns(
                        "/api/auth/login",           // 登录放行
                        "/api/auth/register",        // 注册放行
                        "/api/health"                // 健康检查放行
                );
    }
}