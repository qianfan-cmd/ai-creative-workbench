package com.workbench.backendjava.service;

import com.workbench.backendjava.common.BusinessException;
import com.workbench.backendjava.config.MailProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Optional;

@Slf4j
@Service
public class MailService {

    private static final String NOT_CONFIGURED_MESSAGE =
            "请在 application-local.yml 配置 QQ 邮箱 SMTP（见 application-local.yml.example）";

    private final Optional<JavaMailSender> mailSender;
    private final MailProperties mailProperties;

    @Value("${spring.mail.host:}")
    private String mailHost;

    @Value("${spring.mail.username:}")
    private String fromAddress;

    @Autowired
    public MailService(Optional<JavaMailSender> mailSender, MailProperties mailProperties) {
        this.mailSender = mailSender;
        this.mailProperties = mailProperties;
    }

    public boolean isConfigured() {
        return mailSender.isPresent()
                && StringUtils.hasText(mailHost)
                && StringUtils.hasText(fromAddress);
    }

    public void sendPasswordResetEmail(String to, String resetLink) {
        if (!isConfigured()) {
            throw new BusinessException(503, NOT_CONFIGURED_MESSAGE);
        }

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(formatFromAddress());
        message.setTo(to);
        message.setSubject("重置您的 AI Creative Workbench 密码");
        message.setText(
                "您好，\n\n"
                        + "我们收到了重置密码的请求。请点击以下链接设置新密码（1 小时内有效）：\n\n"
                        + resetLink
                        + "\n\n"
                        + "如果您未请求重置密码，请忽略此邮件。\n\n"
                        + "— AI Creative Workbench"
        );

        try {
            mailSender.get().send(message);
            log.info("密码重置邮件已发送至 {}", to);
        } catch (Exception e) {
            log.error("发送密码重置邮件失败, to={}", to, e);
            throw new BusinessException(503, "邮件发送失败，请稍后重试或联系管理员");
        }
    }

    private String formatFromAddress() {
        String fromName = mailProperties.getFromName();
        if (StringUtils.hasText(fromName)) {
            return fromName + " <" + fromAddress + ">";
        }
        return fromAddress;
    }
}
