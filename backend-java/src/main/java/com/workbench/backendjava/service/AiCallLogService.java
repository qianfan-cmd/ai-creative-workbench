package com.workbench.backendjava.service;

import com.workbench.backendjava.entity.AiCallLog;
import com.workbench.backendjava.mapper.AiCallLogMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

/**
 * AI 调用审计日志：写入 {@code ai_call_log}，供 Admin 用量统计与计费估算。
 */
@Service
@RequiredArgsConstructor
public class AiCallLogService {

    private final AiCallLogMapper aiCallLogMapper;

    /**
     * 完整字段写入（含 imageCount），用于生图类 scene。
     * 调用方：{@link GenerationJobService}、{@link MattingExtractService}。
     */
    public void logCall(Long userId, String scene, String provider, String model, String prompt,
                        String status, int costMs, String summary,
                        Integer promptTokens, Integer completionTokens, Integer totalTokens,
                        Integer imageCount) {
        AiCallLog row = new AiCallLog();
        row.setUserId(userId);
        row.setScene(scene);
        row.setProvider(provider);
        row.setModel(model);
        row.setPrompt(truncate(prompt, 2000));
        row.setStatus(status);
        row.setCostMs(costMs);
        row.setResponseSummary(truncate(summary, 500));
        row.setPromptTokens(promptTokens);
        row.setCompletionTokens(completionTokens);
        row.setTotalTokens(totalTokens);
        row.setImageCount(imageCount);
        row.setCreatedAt(LocalDateTime.now());
        aiCallLogMapper.insert(row);
    }

    /**
     * 写入 token 用量（无 imageCount），用于 Chat/RAG stream、embedding、matting_detect 等。
     * 调用方：{@link com.workbench.backendjava.client.PythonAiClient}、{@link MattingTaskService}。
     */
    public void logCall(Long userId, String scene, String provider, String model, String prompt,
                        String status, int costMs, String summary,
                        Integer promptTokens, Integer completionTokens, Integer totalTokens) {
        logCall(userId, scene, provider, model, prompt, status, costMs, summary,
                promptTokens, completionTokens, totalTokens, null);
    }

    private static String truncate(String s, int max) {
        if (s == null) {
            return null;
        }
        return s.length() > max ? s.substring(0, max) : s;
    }
}
