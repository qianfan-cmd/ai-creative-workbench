package com.workbench.backendjava.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;
import java.nio.file.Paths;

@Configuration
@RequiredArgsConstructor
public class WebMvcConfig implements WebMvcConfigurer {

    private final AuthInterceptor authInterceptor;
    private final UploadProperties uploadProperties;

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

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        /**
         * FileStorageService 用 UploadProperties.dir 写盘
         *     ↓
         * 静态映射也应该用同一个 dir 转成绝对路径
         *     ↓
         * 避免 Windows 下 file:./ 解析偏差
         */
        Path uploadDir = Paths.get(uploadProperties.getDir()).toAbsolutePath().normalize();
        String location = uploadDir.toUri().toString();

        // Windows下确保以 / 结尾
        if (!location.endsWith("/")) {
            location = location + "/";
        }

        registry.addResourceHandler("/uploads/**")
                .addResourceLocations("file:./uploads/");
    }
}