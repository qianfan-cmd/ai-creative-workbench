package com.workbench.backendjava.client;

import com.workbench.backendjava.common.BusinessException;
import com.workbench.backendjava.config.AiServiceProperties;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/**
 * 调用 Python ai-service-python 的 HTTP 客户端。
 *
 * 职责：只负责和 Python 通信，不做登录校验（那是 ChatService 的事）。
 * 类比：Python 里的 llm_service.py 调 DeepSeek；这里是 Java 调 Python。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PythonAiClient {

    private final RestTemplate restTemplate;
    private final AiServiceProperties aiServiceProperties;

    /**
     * 调用python  post ai/chat接口，返回模型文本
     *
     * @param message 用户问题
     * @return 回复
     */
    public String chat(String message) {
        // 拼接完整url
        String url = aiServiceProperties.getBaseUrl().replaceAll("/$", "") + "/ai/chat";

        // 请求体
        Map<String, String> body = Map.of("message", message);

        //HTTP头：告诉对方body是JSON
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        //HttpEntity = headers + body, RestTemplate 的POST参数
        HttpEntity<Map<String, String>> entity = new HttpEntity<>(body, headers);

        log.info("调用 Python AI: url={}, messageLength={}", url, message.length());

        try {
            // 发送POST，把响应JSON自动反序列化成 pythonChatResponse
            PythonChatResponse response = restTemplate.postForObject(
                    url,
                    entity,
                    PythonChatResponse.class
            );

            if (response == null || response.getReply() == null || response.getReply().isBlank()) {
                throw new BusinessException(502, "AI 服务返回内容为空");
            }

            log.info("Python AI 响应成功, model={}", response.getModel());
            return response.getReply();

        } catch (RestClientException e) {
            log.error("调用 Python AI 失败: {}", e.getMessage(), e);
            throw new BusinessException(502, "AI 服务暂时不可用，请确认 ai-service-python 已启动（端口 8000）");
        }
    }

    @Data
    static class PythonChatResponse {
        private String reply;
        private String model;
    }

    /**
     * 探测python是否存活
     */
    public boolean isHealthy() {
        String url = aiServiceProperties.getBaseUrl().replaceAll("/$", "") + "/health";
        try {
            // 发送请求，响应体转成Map
            @SuppressWarnings("unchecked")
            Map<String, Object> body = restTemplate.getForObject(url, Map.class);
            return body != null && "ok".equals(String.valueOf(body.get("status")));
        } catch (RestClientException e) {
            log.warn("Python health 检查失败: {}", e.getMessage());
            return false;
        }
    }
}
