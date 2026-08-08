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

    /**
     * 映射上传的静态资源
     * ResourceHandlerRegistry用来注册[URL->文件夹]映射
     * @param registry
     */
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        /**
         * FileStorageService 用 UploadProperties.dir 写盘
         *     ↓
         * 静态映射也应该用同一个 dir 转成绝对路径
         *     ↓
         * 避免 Windows 下 file:./ 解析偏差
         */
        /**
         * 把配置目录转成绝对Path
         * 步骤	含义
         * uploadProperties.getDir()
         * 从 yml 读 ./uploads
         * Paths.get(...)
         * 字符串 → Path
         * toAbsolutePath()
         * 相对路径 → 绝对路径，避免 Tomcat 临时目录偏差
         * normalize()
         * 去掉 .\、.. 等，路径更干净
         */
        Path uploadDir = Paths.get(uploadProperties.getDir()).toAbsolutePath().normalize();
        /**
         * 转成spring能用的location字符串
         * spring的addResourceLocation需要类似 file:/E:/ai-creative-workbench/backend-java/uploads/
         * file: 表示协议，是本地文件系统的意思，后面是绝对路径
         * 步骤	含义
         * uploadDir.toUri()
         *
         */
        String location = uploadDir.toUri().toString();

        // Windows下确保以 / 结尾
        if (!location.endsWith("/")) {
            location = location + "/";
        }

        registry.addResourceHandler("/uploads/**")// URL匹配规则，表示哪些URL当静态资源
                .addResourceLocations(location);// 磁盘上的真实目录，表示这些URL对应磁盘的哪里
    }
}