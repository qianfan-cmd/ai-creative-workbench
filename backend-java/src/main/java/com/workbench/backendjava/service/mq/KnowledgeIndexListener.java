package com.workbench.backendjava.service.mq;

import com.workbench.backendjava.common.RabbitMqConstants;
import com.workbench.backendjava.dto.mq.KnowledgeIndexMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * 验证MQ连通
 */
@Slf4j
@Component
@ConditionalOnProperty(prefix = "app.rabbit", name = "enabled", havingValue = "true")
public class KnowledgeIndexListener {

    @RabbitListener(queues = RabbitMqConstants.QUEUE_KNOWLEDGE_INDEX)
    public void onKnowledgeIndex(KnowledgeIndexMessage message) {
        log.info("[MQ smoke] 收到索引任务 jobId={} userId={} documentId={} filename={}",
                message.getJobId(), message.getUserId(),
                message.getDocumentId(), message.getFilename());
        // 第 5 步：markRunning → indexDocument → markSucceeded / markFailed → 手动 ACK
    }
}
