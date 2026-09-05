package com.workbench.backendjava.service;

import org.springframework.util.StringUtils;

import java.util.Map;

/** 管理后台 AI 用量：场景/模型中文展示名 */
public final class AiUsageLabels {

    private static final Map<String, String> SCENE_LABELS = Map.ofEntries(
            Map.entry("chat", "智能对话"),
            Map.entry("copy", "活动文案生成"),
            Map.entry("embedding", "知识库向量化"),
            Map.entry("image_gen", "配图生成"),
            Map.entry("matting", "抠图"),
            Map.entry("matting_detect", "抠图 · 元素识别"),
            Map.entry("matting_extract", "抠图 · 分组提取（生图）"),
            Map.entry("matting_single", "抠图 · 单元素提取（生图）"),
            Map.entry("unknown", "未识别场景")
    );

    private static final Map<String, String> MODEL_DISPLAY_NAMES = Map.ofEntries(
            Map.entry("deepseek-v4-flash", "DeepSeek V4 Flash（对话/文案）"),
            Map.entry("text-embedding-v2", "百炼 Embedding v2（知识库）"),
            Map.entry("wan2.7-image-pro", "通义万相 wan2.7-image-pro（生图）"),
            Map.entry("doubao-seedream-5-0-260128", "Seedream 5.0（生图）"),
            Map.entry("qwen-vl-max", "千问视觉 Max（元素识别）"),
            Map.entry("seedream", "Seedream 5.0（生图）"),
            Map.entry("dashscope_wanx", "通义万相 wan2.7-image-pro（生图兜底）"),
            Map.entry("unknown", "未识别模型")
    );

    private AiUsageLabels() {
    }

    public static String sceneLabel(String scene) {
        if (!StringUtils.hasText(scene)) {
            return SCENE_LABELS.get("unknown");
        }
        return SCENE_LABELS.getOrDefault(scene, scene);
    }

    public static String modelDisplayName(String pricingKey) {
        if (!StringUtils.hasText(pricingKey)) {
            return MODEL_DISPLAY_NAMES.get("unknown");
        }
        return MODEL_DISPLAY_NAMES.getOrDefault(pricingKey, pricingKey);
    }
}
