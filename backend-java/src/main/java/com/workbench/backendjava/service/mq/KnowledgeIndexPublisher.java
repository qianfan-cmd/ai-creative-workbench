package com.workbench.backendjava.service.mq;

import com.workbench.backendjava.common.RabbitMqConstants;
import com.workbench.backendjava.dto.mq.KnowledgeIndexMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "app.rabbit", name = "enabled", havingValue = "true")
public class KnowledgeIndexPublisher {

    private final RabbitTemplate rabbitTemplate;

    public void publish(KnowledgeIndexMessage message) {
        rabbitTemplate.convertAndSend(
                RabbitMqConstants.EXCHANGE_TASKS,
                RabbitMqConstants.ROUTING_KEY_KNOWLEDGE_INDEX,
                message
        );
        log.info("已投递 knowledge.index jobId={} documentId={}",
        message.getJobId(), message.getDocumentId());
    }
}
