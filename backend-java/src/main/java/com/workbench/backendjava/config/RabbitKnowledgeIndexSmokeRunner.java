package com.workbench.backendjava.config;

import com.workbench.backendjava.dto.mq.KnowledgeIndexMessage;
import com.workbench.backendjava.service.mq.KnowledgeIndexPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** 本地一次性连通性测试；验收后把 app.rabbit.smoke-test 改回 false */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "app.rabbit", name = "smoke-test", havingValue = "true")
public class RabbitKnowledgeIndexSmokeRunner implements ApplicationRunner {

    private final KnowledgeIndexPublisher publisher;

    @Override
    public void run(ApplicationArguments args) {
        log.info("Rabbit smoke-test：发送测试消息到 knowledge.index …");
        publisher.publish(new KnowledgeIndexMessage(0L, 1L, 999L, "smoke-test.pdf"));
    }
}