package com.workbench.backendjava.service.mq;

import com.workbench.backendjava.common.RabbitMqConstants;
import com.workbench.backendjava.dto.mq.KnowledgeIndexMessage;
import com.workbench.backendjava.service.KnowledgeDocumentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * 验证MQ连通
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "app.rabbit", name = "enabled", havingValue = "true")
public class KnowledgeIndexListener {

    private final KnowledgeDocumentService knowledgeDocumentService;

    /**
     * Spring + JSON 转换器把消息体反序列化成 Java 对象
     */
    @RabbitListener(queues = RabbitMqConstants.QUEUE_KNOWLEDGE_INDEX)
    public void onKnowledgeIndex(KnowledgeIndexMessage message) {
        log.info("[MQ smoke] 收到索引任务 jobId={} userId={} documentId={} filename={}",
                message.getJobId(), message.getUserId(),
                message.getDocumentId(), message.getFilename());
        // 第 5 步：markRunning → indexDocument → markSucceeded / markFailed → 手动 ACK
        knowledgeDocumentService.consumeKnowledgeIndex(message);
    }
}
