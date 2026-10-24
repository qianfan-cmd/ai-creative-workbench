package com.workbench.backendjava.config;

import com.workbench.backendjava.common.RabbitMqConstants;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.rabbit.annotation.EnableRabbit;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 注解的涵义是一个队列开关，若enabled不为true则不开启消息队列
 * @EnableRabbit作用包括：识别@RabbitListener（消费者方法）、配合RabbitTemplate发消息等
 */
@Configuration
@EnableRabbit
@ConditionalOnProperty(prefix = "app.rabbit", name = "enabled", havingValue = "true")
public class RabbitMqConfig {

    /** direct 交换机：按 routing key 精确投递
     * 参数
     * name：RabbitMqConstants.EXCHANGE_TASKS 交换机名
     * durable：true 持久化：RabbitMQ进程重启后交换机还在
     * autoDelete: false 不要在没有任何绑定时自动删交换机
     */
    @Bean
    public DirectExchange workbenchTasksExchange() {
        return new DirectExchange(RabbitMqConstants.EXCHANGE_TASKS, true, false);
    }
    /** 持久化队列：broker 重启后队列仍在（消息是否持久化看发送方，第 5 步再加强）
     *  Queue(String name, boolean durable) 队列名，队列元数据持久化，Broker重启后队列还在
     *  durable队列 ！= 每条消息都落盘。消息还要发送时设 deliveryMode = PERSISTENT等才会
     *  在重启后尽量不丢；
     */
    @Bean
    public Queue knowledgeIndexQueue() {
        return new Queue(RabbitMqConstants.QUEUE_KNOWLEDGE_INDEX, true);
    }

    /**
     * 队列和交换机之间绑定关系
     * @param knowledgeIndexQueue
     * @param workbenchTasksExchange
     * @return
     */
    @Bean
    public Binding knowledgeIndexBinding(Queue knowledgeIndexQueue, DirectExchange workbenchTasksExchange) {
        /**
         * BindingBuilder.bind(queue)从指定队列开始建绑定
         * .to(workbenchTasksExchange)绑到哪个交换机
         * .with(routingKey) routingKey = "knowledge.index"
         * 发现交换机workbench.tasks、且routing key 为knowledge.index的消息就进入队列
         * Binding 就是这条规则在Spring/RabbitMQ里的对象表示；启动时同同样会declare到Broker
         */
        return BindingBuilder.bind(knowledgeIndexQueue)
                .to(workbenchTasksExchange)
                .with(RabbitMqConstants.ROUTING_KEY_KNOWLEDGE_INDEX);
    }

    /**
     * 消息体自动JSON-JAVA对象
     * MessageConverter 转换器接口，Jackson2JsonMessageConverter是实现类
     * MessageConverter RabbitMQ线上传的是字节 + 属性； java里要发的是KnowledgeIndexMessage
     *
     * Jackson2JsonMessageConverter
     *  发送：RabbitTemplate.convertAndSend(..., messageObject) -> body 变成 JSON字节
     *  接收：@RabbitListener 方法参数写 KnowledgeIndexMessage -> 从JSON反序列化
     *  无参构造 = 用默认 Jackson 规则（字段名、基本类型等）。Spring Boot
     *  发现容器里有 MessageConverter Bean，会配给 RabbitTemplate 和 listener 工厂。
     */
    @Bean
    public MessageConverter jackson2JsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }
}
