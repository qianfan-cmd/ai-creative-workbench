package com.workbench.backendjava.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.workbench.backendjava.common.AsyncJobConstants;
import com.workbench.backendjava.common.BusinessException;
import com.workbench.backendjava.common.LoginUserContext;
import com.workbench.backendjava.entity.AsyncJob;
import com.workbench.backendjava.mapper.AsyncJobMapper;
import com.workbench.backendjava.vo.AsyncJobVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.kafka.SslBundleSslEngineFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * async_job 生命周期：创建 pending →（Worker）running → succeeded/failed。
 * payload 只存 documentId + filename，不存文件 bytes。
 */
@Service
@RequiredArgsConstructor
public class AsyncJobService {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;
    private final AsyncJobMapper asyncJobMapper;
    private final ObjectMapper objectMapper;

    /**
     * 创建 pending 任务
     * payload 只存 documentId + filename，不存文件 bytes
     */
    @Transactional
    public AsyncJob createDocumentIndexJob(Long userId, Long documentId, String filename) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("documentId", documentId);
        payload.put("filename", filename);

        AsyncJob job = new AsyncJob();
        job.setUserId(userId);
        job.setType(AsyncJobConstants.TYPE_DOCUMENT_INDEX);
        job.setStatus(AsyncJobConstants.STATUS_PENDING);
        job.setPayloadJson(toJson(payload));
        job.setCreatedAt(LocalDateTime.now());
        job.setUpdatedAt(LocalDateTime.now());
        asyncJobMapper.insert(job);
        return job;
    }

    /**
     * 当前登录用户查询自己的任务，否则 404
     */
    public AsyncJobVO getJobForCurrentUser(Long jobId) {
        Long userId = requiredUserId();
        AsyncJob job = asyncJobMapper.selectById(jobId);
        if (job == null || !userId.equals(job.getUserId())) {
            throw new BusinessException(404, "任务不存在");
        }
        return toVO(job);
    }

    /**
     * Worker 开始处理：仅 pending/failed 可进入 running
     */
    @Transactional
    public boolean markRunning(Long jobId) {
        AsyncJob job = asyncJobMapper.selectById(jobId);
        if (job == null) {
            return false;
        }
        String s = job.getStatus();
        if (!AsyncJobConstants.STATUS_PENDING.equals(s)
                && !AsyncJobConstants.STATUS_FAILED.equals(s)) {
            return false;
        }
        job.setStatus(AsyncJobConstants.STATUS_RUNNING);
        job.setErrorMessage(null);
        job.setUpdatedAt(LocalDateTime.now());
        asyncJobMapper.updateById(job);
        return true;
    }

    @Transactional
    public void markSucceeded(Long jobId) {
        AsyncJob job = requireJob(jobId);
        job.setStatus(AsyncJobConstants.STATUS_SUCCEEDED);
        job.setUpdatedAt(LocalDateTime.now());
        asyncJobMapper.updateById(job);
    }

    @Transactional
    public void markFailed(Long jobId, String message) {
        AsyncJob job = requireJob(jobId);
        job.setStatus(AsyncJobConstants.STATUS_FAILED);
        job.setErrorMessage(truncate(message, 500));
        job.setUpdatedAt(LocalDateTime.now());
        asyncJobMapper.updateById(job);
    }

    /**
     * error 字符数限制
     * @param msg
     * @param max
     * @return
     */
    private static String truncate(String msg, int max) {
        if (msg == null) {
            return null;
        }
        return msg.length() <= max ? msg : msg.substring(0, max);
    }

    private AsyncJob requireJob(Long jobId) {
        AsyncJob job = asyncJobMapper.selectById(jobId);
        if (job == null) {
            throw new BusinessException(404, "任务不存在");
        }
        return job;
    }

    /**
     * 对象转 String
     * @param payload
     * @return
     */
    private String toJson(Map<String, Object> payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            throw new BusinessException(500, "任务参数序列化失败");
        }
    }

    private Long requiredUserId() {
        Long userId = LoginUserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(401, "未登录");
        }
        return userId;
    }

    private AsyncJobVO toVO(AsyncJob job) {
        AsyncJobVO vo = new AsyncJobVO();
        vo.setId(job.getId());
        vo.setType(job.getType());
        vo.setStatus(job.getStatus());
        vo.setErrorMessage(job.getErrorMessage());
        vo.setCreatedAt(formatTime(job.getCreatedAt()));
        vo.setUpdatedAt(formatTime(job.getUpdatedAt()));

        parsePayload(job.getPayloadJson(), vo);
        return vo;
    }

    /**
     * 从一个 JSON 字符串中解析出 documentId 和 filename，并把它们设置到 AsyncJobVO 对象中。
     * 如果 JSON 为空、空白或解析失败，就静默忽略，保证不影响主流程。
     * @param json
     * @param vo
     */
    @SuppressWarnings("unchecked")
    private void parsePayload(String json, AsyncJobVO vo) {
        if (json == null || json.isBlank()) {
            return;
        }
        try {
            Map<String, Object> map = objectMapper.readValue(json, Map.class);
            Object docId = map.get("documentId");
            if (docId instanceof Number) {
                vo.setDocumentId(((Number) docId).longValue());
            }
            Object name = map.get("filename");
            if (name != null) {
                vo.setFilename(String.valueOf(name));
            }
        } catch (JsonProcessingException ignored) {

        }
    }

    /**
     * 把时间类型转换成字符串类型
     * @param
     * @return
     */
    private static String formatTime(LocalDateTime t) {
        return t == null ? null : t.format(ISO);
    }
}
