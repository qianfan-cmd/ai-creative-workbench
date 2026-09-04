package com.workbench.backendjava.config;

import com.workbench.backendjava.service.MailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class MailStartupRunner implements ApplicationRunner {

    private final MailService mailService;
    private final MailProperties mailProperties;

    @Override
    public void run(ApplicationArguments args) {
        boolean configured = mailService.isConfigured();
        log.info("Mail provider={}, configured={}", mailProperties.getProvider(), configured);
        if (!configured) {
            log.warn("找回密码邮件不可用：请在 application-local.yml 配置 QQ SMTP（见 application-local.yml.example）");
        }
    }
}
