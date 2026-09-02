package com.workbench.backendjava.client;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.workbench.backendjava.common.BusinessException;
import com.workbench.backendjava.config.AiServiceProperties;
import com.workbench.backendjava.dto.RagHistoryItem;
import com.workbench.backendjava.vo.KnowledgeDocumentVO;
import com.workbench.backendjava.vo.KnowledgeUploadVO;
import com.workbench.backendjava.vo.RagQueryVO;
import com.workbench.backendjava.vo.RagReferenceVO;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

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
    private final ObjectMapper objectMapper;

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


    /**
     * 调用 Python POST /ai/rag/query，返回 RAG 问答结果。
     *
     * @param question 用户问题
     * @param topK     检索条数，传给 Python 的 top_k
     */
    public RagQueryVO ragQuery(String question, int topK, List<RagHistoryItem> history) {
        String url = aiServiceProperties.getBaseUrl().replaceAll("/$", "") + "/ai/rag/query";

        Map<String, Object> body = new HashMap<>();
        body.put("question", question);
        body.put("top_k", topK);
        body.put("history", history != null ? history : List.of());

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        log.info("调用 Python RAG: url={}, questionLength={}, topK={}", url, question.length(), topK);

        try {
            PythonRagResponse response = restTemplate.postForObject(
                    url,
                    entity,
                    PythonRagResponse.class
            );

            if (response == null || response.getAnswer() == null || response.getAnswer().isBlank()) {
                throw new BusinessException(502, "RAG 服务返回为空");
            }

            RagQueryVO vo = new RagQueryVO();
            vo.setAnswer(response.getAnswer());

            if (response.getReferences() != null) {
                List<RagReferenceVO> refs = response.getReferences().stream()
                        .map(ref -> {
                            RagReferenceVO r = new RagReferenceVO();
                            r.setContent(ref.getContent());
                            r.setSource(ref.getSource());
                            r.setIndex(ref.getIndex());
                            return r;
                        })
                        .collect(Collectors.toList());
                vo.setReferences(refs);
            }

            return vo;
        } catch (RestClientException e) {
            log.error("调用 Python RAG 失败: {}", e.getMessage(), e);
            throw new BusinessException(502, "RAG 服务暂时不可用，请确认 ai-service-python 已启动（端口 8000）");
        }

    }

    /**
     * 调用 Python GET /ai/documents/list，获取已索引文档列表。
     * Chroma 当前全局共享，未按 userId 隔离。
     */
    public List<KnowledgeDocumentVO> listDocuments() {
        String url = aiServiceProperties.getBaseUrl().replaceAll("/$", "") + "/ai/documents/list";
        try {
            PythonDocumentListResponse response = restTemplate.getForObject(url, PythonDocumentListResponse.class);
            if (response == null || response.getDocuments() == null) {
                return List.of();
            }
            return response.getDocuments().stream().map(item -> {
                KnowledgeDocumentVO vo = new KnowledgeDocumentVO();
                vo.setFilename(item.getFilename());
                vo.setChunkCount(item.getChunkCount());
                return vo;
            }).collect(Collectors.toList());
        } catch (RestClientException e) {
            log.error("调用 Python 文档列表失败: {}", e.getMessage(), e);
            throw new BusinessException(502, "知识库文档列表不可用，请确认 ai-service-python 已启动");
        }
    }

    /**
     * 转发文件到 Python POST /ai/documents/index，完成 RAG 入库。
     */
    public KnowledgeUploadVO indexDocument(MultipartFile file) {
        try {
            return indexDocument(file.getBytes(), file.getOriginalFilename(), null, null);
        } catch (Exception e) {
            throw new BusinessException(500, "读取上传文件失败: " + e.getMessage());
        }
    }

    public KnowledgeUploadVO indexDocument(byte[] bytes, String filename, Long documentId, Long userId) {
        String url = aiServiceProperties.getBaseUrl().replaceAll("/$", "") + "/ai/documents/index";

        try {
            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();

            ByteArrayResource resource = new ByteArrayResource(bytes) {
                @Override
                public String getFilename() {
                    return filename;
                }
            };
            body.add("file", resource);
            if (documentId != null) {
                body.add("document_id", String.valueOf(documentId));
            }
            if (userId != null) {
                body.add("user_id", String.valueOf(userId));
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            HttpEntity<MultiValueMap<String, Object>> entity = new HttpEntity<>(body, headers);

            log.info("调用 Python 文档入库: url={}, filename={}, size={}, documentId={}",
                    url, filename, bytes.length, documentId);

            PythonIndexResponse response = restTemplate.postForObject(
                    url,
                    entity,
                    PythonIndexResponse.class
            );

            if (response == null || response.getIndexedCount() == null || response.getIndexedCount() <= 0) {
                throw new BusinessException(502, "文档入库失败，未写入向量库");
            }

            KnowledgeUploadVO vo = new KnowledgeUploadVO();
            vo.setFilename(response.getFilename());
            vo.setCharCount(response.getCharCount());
            vo.setChunkCount(response.getChunkCount());
            vo.setIndexedCount(response.getIndexedCount());
            return vo;
        } catch (RestClientException e) {
            log.error("调用 Python 文档入库失败: {}", e.getMessage(), e);
            throw new BusinessException(502, "知识库入库服务不可用，请确认 ai-service-python 已启动");
        }
    }

    /**
     * 按 Chroma source / document_id 删除文档向量（POST JSON，避免 query 编码问题）。
     *
     * @param expectedChunkCount MySQL 记录的 chunk 数；&gt;0 时要求至少删除 1 条
     * @return 实际删除的 chunk 数
     */
    public int deleteDocument(String source, Long documentId, int expectedChunkCount) {
        boolean hasSource = source != null && !source.isBlank();
        boolean hasDocumentId = documentId != null && documentId > 0;
        if (!hasSource && !hasDocumentId) {
            return 0;
        }

        String url = aiServiceProperties.getBaseUrl().replaceAll("/$", "") + "/ai/documents/delete";

        Map<String, Object> body = new HashMap<>();
        if (hasDocumentId) {
            body.put("document_id", documentId);
        }
        if (hasSource) {
            body.put("source", source.trim());
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        try {
            PythonDocumentDeleteResponse response = restTemplate.postForObject(
                    url,
                    entity,
                    PythonDocumentDeleteResponse.class
            );
            int deletedCount = response != null && response.getDeletedCount() != null
                    ? response.getDeletedCount()
                    : 0;

            if (expectedChunkCount > 0 && deletedCount <= 0) {
                throw new BusinessException(502, "向量索引未删除，请重试");
            }
            return deletedCount;
        } catch (RestClientException e) {
            log.error("调用 Python 文档删除失败 source={}, documentId={}: {}",
                    source, documentId, e.getMessage(), e);
            throw new BusinessException(502, "删除向量索引失败，请确认 ai-service-python 已启动");
        }
    }

    /** 重命名/重索引等场景：按 source 删除，不要求 chunk 校验 */
    public void deleteDocument(String source) {
        deleteDocument(source, null, 0);
    }

    /**
     * 调用 Python POST /ai/chat/stream，把 SSE 事件转发到 emitter。
     * messages 为 DeepSeek 多轮格式 [{role, content}, ...]。
     */
    public void chatStream(List<Map<String, String>> messages, SseEmitter emitter) {
        String url = aiServiceProperties.getBaseUrl().replaceAll("/$", "") + "/ai/chat/stream";

        CompletableFuture.runAsync(() -> {
            try {
                Map<String, Object> body = new HashMap<>();
                body.put("messages", messages);
                String jsonBody = objectMapper.writeValueAsString(body);
                log.info("转发 Python Chat stream, url={}, messageCount={}", url, messages.size());

                restTemplate.execute(
                        url,
                        HttpMethod.POST,
                        request -> {
                            request.getHeaders().setContentType(MediaType.APPLICATION_JSON);
                            request.getBody().write(jsonBody.getBytes(StandardCharsets.UTF_8));
                        },
                        response -> {
                            forwardPythonSse(response, emitter);
                            return null;
                        }
                );
            } catch (HttpStatusCodeException e) {
                sendStreamError(emitter, "Python HTTP " + e.getStatusCode().value() + ": " + e.getResponseBodyAsString());
            } catch (Exception e) {
                log.error("Chat 流式转发失败", e);
                sendStreamError(emitter, e.getMessage() != null ? e.getMessage() : "Chat 流式服务不可用");
            }
        });
    }

    /**
     * 调用 Python POST /ai/rag/query-stream，把 SSE 事件转发到 emitter。
     * 在异步线程里跑，避免阻塞 Tomcat 请求线程。
     */
    public void ragQueryStream(String question, int topK, List<RagHistoryItem> history, SseEmitter emitter) {
        String url = aiServiceProperties.getBaseUrl().replaceAll("/$", "") + "/ai/rag/query-stream";

        CompletableFuture.runAsync(() -> {
            try {
                Map<String, Object> body = new HashMap<>();
                body.put("question", question);
                body.put("top_k", topK);
                body.put("history", history != null ? history : List.of());
                String jsonBody = objectMapper.writeValueAsString(body);
                log.info("转发 Python RAG stream, url={}, jsonBody={}", url, jsonBody);

                // 与非流式 ragQuery 相同，用 RestTemplate 发 JSON，避免 HttpClient body 丢失
                restTemplate.execute(
                        url,
                        HttpMethod.POST,
                        request -> {
                            request.getHeaders().setContentType(MediaType.APPLICATION_JSON);
                            request.getBody().write(jsonBody.getBytes(StandardCharsets.UTF_8));
                        },
                        response -> {
                            forwardPythonSse(response, emitter);
                            return null;
                        }
                );
            } catch (HttpStatusCodeException e) {
                sendStreamError(emitter, "Python HTTP " + e.getStatusCode().value() + ": " + e.getResponseBodyAsString());
            } catch (Exception e) {
                log.error("RAG流式转发失败", e);
                sendStreamError(emitter, e.getMessage() != null ? e.getMessage() : "RAG 流式服务不可用");
            }
        });
    }

    /** 读取 Python SSE 响应并转发到前端 SseEmitter */
    private void forwardPythonSse(ClientHttpResponse response, SseEmitter emitter) throws IOException {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(response.getBody(), StandardCharsets.UTF_8))) {

            String currentEvent = "";
            String line;

            while ((line = reader.readLine()) != null) {
                if (line.startsWith("event:")) {
                    currentEvent = line.substring(6).trim();
                } else if (line.startsWith("data:")) {
                    String data = line.substring(5).trim();

                    if ("done".equals(currentEvent) || "[DONE]".equals(data)) {
                        emitter.send(SseEmitter.event().name("done").data("[DONE]"));
                    } else if ("error".equals(currentEvent)) {
                        sendStreamError(emitter, data);
                        return;
                    } else {
                        emitter.send(SseEmitter.event().name(currentEvent).data(data));
                    }
                } else if (line.isEmpty()) {
                    currentEvent = "";
                }
            }
        }

        emitter.complete();
    }

    /** 向前端推送 SSE error 事件并正常结束流（便于 UI 在 AI 气泡里展示错误） */
    private void sendStreamError(SseEmitter emitter, String message) {
        try {
            emitter.send(SseEmitter.event().name("error").data(message));
            emitter.send(SseEmitter.event().name("done").data("[DONE]"));
            emitter.complete();
        } catch (IOException e) {
            emitter.completeWithError(e);
        }
    }

    /**
     * 提示词 流式渲染
     * @param template
     * @param variables
     * @return
     */
    public String renderPrompt(String template, Map<String, String> variables) {
        String url = aiServiceProperties.getBaseUrl().replaceAll("/$", "") + "/ai/ops/render-prompt";
        Map<String, Object> body = new HashMap<>();
        body.put("template", template);
        body.put("variables", variables);

        try {
            ResponseEntity<Map> resp = restTemplate.postForEntity(url, body, Map.class);
            Map data = resp.getBody();
            if (data == null || data.get("prompt") == null) {
                throw new BusinessException(502, "Prompt 渲染失败");
            }
            return data.get("prompt").toString();
        } catch (RestClientException e) {
            throw new BusinessException(502, "Prompt 渲染服务不可用");
        }
    }

    public void opsCopyStream(String prompt, SseEmitter emitter) {
        String url = aiServiceProperties.getBaseUrl().replaceAll("/$", "") + "/ai/ops/copy/stream";

        CompletableFuture.runAsync(() -> {
            try {
                Map<String, Object> body = Map.of("prompt", prompt);
                String jsonBody = objectMapper.writeValueAsString(body);

                restTemplate.execute(
                        url,
                        HttpMethod.POST,
                        request -> {
                            request.getHeaders().setContentType(MediaType.APPLICATION_JSON);
                            request.getBody().write(jsonBody.getBytes(StandardCharsets.UTF_8));
                        },
                        response -> {
                            forwardPythonSse(response, emitter);
                            return null;
                        }
                );
            } catch (Exception e) {
                log.error("Ops copy stream 转发失败", e);
                sendStreamError(emitter, e.getMessage() != null ? e.getMessage() : "文案流式服务不可用");
            }
        });
    }

    /** 调用 Python POST /ai/ops/image-gen */
    public PythonImageGenerateResponse opsImageGen(String prompt, String sourceUrl, int count, String aspectRatio) {
        return callImageEndpoint("/ai/ops/image-gen", prompt, sourceUrl, count, aspectRatio);
    }

    /** 调用 Python POST /ai/ops/matting */
    public PythonImageGenerateResponse opsMatting(String prompt, String sourceUrl, int count, String aspectRatio) {
        return callImageEndpoint("/ai/ops/matting", prompt, sourceUrl, count, aspectRatio);
    }

    /** 视觉元素识别 POST /ai/ops/detect-elements */
    public Map<String, List<String>> opsDetectElements(String imageUrl, String prompt) {
        return opsDetectElements(imageUrl, prompt, null);
    }

    /** 视觉元素识别 — 可选传 imageBytes 作为 L2 inline base64 兜底 */
    @SuppressWarnings("unchecked")
    public Map<String, List<String>> opsDetectElements(String imageUrl, String prompt, byte[] imageBytes) {
        String url = aiServiceProperties.getBaseUrl().replaceAll("/$", "") + "/ai/ops/detect-elements";
        Map<String, Object> body = new HashMap<>();
        if (imageUrl != null && !imageUrl.isBlank()) {
            body.put("imageUrl", imageUrl);
        }
        if (imageBytes != null && imageBytes.length > 0) {
            body.put("imageBase64", Base64.getEncoder().encodeToString(imageBytes));
        }
        body.put("prompt", prompt);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        try {
            ResponseEntity<Map> resp = restTemplate.postForEntity(
                    url, new HttpEntity<>(body, headers), Map.class);
            Map data = resp.getBody();
            if (data == null || data.get("groups") == null) {
                throw new BusinessException(502, "元素识别未返回 groups");
            }
            return (Map<String, List<String>>) data.get("groups");
        } catch (HttpStatusCodeException e) {
            String msg = e.getResponseBodyAsString();
            throw new BusinessException(502, msg != null && !msg.isBlank() ? msg : "元素识别服务调用失败");
        } catch (RestClientException e) {
            throw new BusinessException(502, "元素识别服务不可用");
        }
    }

    /** 元素提取 POST /ai/ops/extract-element */
    public PythonImageGenerateResponse opsExtractElement(String sourceUrl, String prompt, int count) {
        return opsExtractElement(sourceUrl, prompt, count, null);
    }

    /** 元素提取 — 可选传 imageBytes 作为 L2 inline base64 兜底 */
    public PythonImageGenerateResponse opsExtractElement(
            String sourceUrl, String prompt, int count, byte[] imageBytes
    ) {
        String url = aiServiceProperties.getBaseUrl().replaceAll("/$", "") + "/ai/ops/extract-element";
        Map<String, Object> body = new HashMap<>();
        if (sourceUrl != null && !sourceUrl.isBlank()) {
            body.put("sourceUrl", sourceUrl);
        }
        if (imageBytes != null && imageBytes.length > 0) {
            body.put("imageBase64", Base64.getEncoder().encodeToString(imageBytes));
        }
        body.put("prompt", prompt);
        body.put("count", count);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        try {
            ResponseEntity<PythonImageGenerateResponse> resp = restTemplate.postForEntity(
                    url, new HttpEntity<>(body, headers), PythonImageGenerateResponse.class);
            PythonImageGenerateResponse data = resp.getBody();
            if (data == null || data.getCandidates() == null || data.getCandidates().isEmpty()) {
                throw new BusinessException(502, "图像服务未返回候选");
            }
            return data;
        } catch (HttpStatusCodeException e) {
            String msg = e.getResponseBodyAsString();
            throw new BusinessException(502, msg != null && !msg.isBlank() ? msg : "图像服务调用失败");
        } catch (RestClientException e) {
            throw new BusinessException(502, "图像服务不可用");
        }
    }

    private PythonImageGenerateResponse callImageEndpoint(
            String path, String prompt, String sourceUrl, int count, String aspectRatio
    ) {
        String url = aiServiceProperties.getBaseUrl().replaceAll("/$", "") + path;
        Map<String, Object> body = new java.util.HashMap<>();
        body.put("prompt", prompt);
        if (sourceUrl != null && !sourceUrl.isBlank()) {
            body.put("sourceUrl", sourceUrl);
        }
        body.put("count", count);
        if (aspectRatio != null && !aspectRatio.isBlank()) {
            body.put("aspectRatio", aspectRatio);
        }
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        try {
            ResponseEntity<PythonImageGenerateResponse> resp = restTemplate.postForEntity(
                    url, new HttpEntity<>(body, headers), PythonImageGenerateResponse.class);
            PythonImageGenerateResponse data = resp.getBody();
            if (data == null || data.getCandidates() == null || data.getCandidates().isEmpty()) {
                throw new BusinessException(502, "图像服务未返回候选");
            }
            return data;
        } catch (HttpStatusCodeException e) {
            String msg = e.getResponseBodyAsString();
            throw new BusinessException(502, msg != null && !msg.isBlank() ? msg : "图像服务调用失败");
        } catch (RestClientException e) {
            throw new BusinessException(502, "图像服务不可用");
        }
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

    @Data
    static class PythonChatResponse {
        private String reply;
        private String model;
    }

    @Data
    static class PythonRagResponse {
        private String answer;
        private List<PythonRagReference> references;
    }

    @Data
    static class PythonRagReference {
        private String content;
        private String source;
        private Integer index;
    }

    @Data
    static class PythonIndexResponse {
        private String filename;

        @JsonProperty("char_count")
        private Integer charCount;

        @JsonProperty("chunk_count")
        private Integer chunkCount;

        @JsonProperty("indexed_count")
        private Integer indexedCount;
    }

    @Data
    static class PythonDocumentListResponse {
        private List<PythonDocumentListItem> documents;
    }

    @Data
    static class PythonDocumentListItem {
        private String filename;

        @JsonProperty("chunk_count")
        private Integer chunkCount;
    }

    @Data
    static class PythonDocumentDeleteResponse {
        private String source;

        @JsonProperty("document_id")
        private Long documentId;

        @JsonProperty("deleted_count")
        private Integer deletedCount;
    }

    @Data
    public static class PythonImageGenerateResponse {
        private String provider;
        private List<PythonImageCandidate> candidates;
    }

    @Data
    public static class PythonImageCandidate {
        private String url;
        private Integer index;
    }
}
