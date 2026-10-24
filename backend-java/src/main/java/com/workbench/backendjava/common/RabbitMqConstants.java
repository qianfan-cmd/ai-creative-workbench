package com.workbench.backendjava.common;

/**
 * Wave E-B3 任务队列命名（与 docs/phase4-wave-e-requirements.md 一致）。
 * E-B4 抠图会再加 routing key，共用同一 exchange。
 */
public final class RabbitMqConstants {

    private RabbitMqConstants() {
    }

    public static final String EXCHANGE_TASKS = "workbench.tasks";

    /** 队列名；@RabbitListener 注解要求编译期常量 */
    public static final String QUEUE_KNOWLEDGE_INDEX = "knowledge.index";

    public static final String ROUTING_KEY_KNOWLEDGE_INDEX = "knowledge.index";
}