package com.workbench.backendjava.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration // 告诉spring这是一个配置类
public class PasswordConfig {

    @Bean // 向spring容器注册一个PasswordEncoder对象，之后在UserService中注入就能直接用，不需要去new BCryptPasswordEncoder()
    public PasswordEncoder passwordEncoder() {
        /**
         *  BCrypt 是单向哈希，不能解密，只能 encode 存库、matches 验登录
         */
        return new BCryptPasswordEncoder();
    }
}
