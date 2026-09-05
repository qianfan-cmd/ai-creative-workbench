package com.workbench.backendjava.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.workbench.backendjava.client.PythonAiClient;
import com.workbench.backendjava.client.PythonAiClient.PythonImageCandidate;
import com.workbench.backendjava.client.PythonAiClient.PythonImageGenerateResponse;
import com.workbench.backendjava.common.BusinessException;
import com.workbench.backendjava.entity.GenerationJob;
import com.workbench.backendjava.mapper.GenerationJobMapper;
import com.workbench.backendjava.vo.GenerationJobVO;
import com.workbench.backendjava.vo.ImageCandidateVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** 生图/抠图任务编排 — 写 generation_job、调 Python、记 ai_call_log。 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GenerationJobService {

    private final GenerationJobMapper generationJobMapper;
    private final AiCallLogService aiCallLogService;
    private final PythonAiClient pythonAiClient;
    private final AssetService assetService;
    private final ObjectMapper objectMapper;

    @Transactional
    public GenerationJobVO runJob(
            Long userId,
            String jobType,
            Long refTaskId,
            Long refDraftId,
            String prompt,
            String sourceUrl,
            int count,
            String aspectRatio
    ) {
        GenerationJob job = new GenerationJob();
        job.setUserId(userId);
        job.setJobType(jobType);
        job.setRefTaskId(refTaskId);
        job.setRefDraftId(refDraftId);
        job.setStatus("running");
        job.setInputJson(writeJson(Map.of(
                "prompt", prompt,
                "sourceUrl", sourceUrl != null ? sourceUrl : "",
                "count", count,
                "aspectRatio", aspectRatio != null ? aspectRatio : ""
        )));
        job.setCreatedAt(LocalDateTime.now());
        job.setUpdatedAt(LocalDateTime.now());
        generationJobMapper.insert(job);

        long startMs = System.currentTimeMillis();
        try {
            AssetService.ProviderImageRef imageRef = (sourceUrl != null && !sourceUrl.isBlank())
                    ? resolveReferenceForJob(sourceUrl, userId)
                    : new AssetService.ProviderImageRef(null, null);
            PythonImageGenerateResponse resp = "matting".equals(jobType)
                    ? pythonAiClient.opsMatting(
                            prompt, imageRef.sourceUrl(), count, aspectRatio, imageRef.imageBytes())
                    : pythonAiClient.opsImageGen(
                            prompt, imageRef.sourceUrl(), count, aspectRatio, imageRef.imageBytes());

            job.setProviderUsed(resp.getProvider());
            job.setCandidatesJson(writeJson(resp.getCandidates()));
            job.setStatus("done");
            job.setUpdatedAt(LocalDateTime.now());
            generationJobMapper.updateById(job);

            int imageCount = resp.getCandidates() != null ? resp.getCandidates().size() : 0;
            String modelId = resolveImageModel(resp);
            writeCallLog(userId, jobType, resp.getProvider(), modelId, prompt, "success",
                    (int) (System.currentTimeMillis() - startMs),
                    imageCount + " images", imageCount);
            return toVO(job, resp.getCandidates());
        } catch (BusinessException e) {
            failJob(job, e.getMessage());
            writeCallLog(userId, jobType, null, null, prompt, "failed",
                    (int) (System.currentTimeMillis() - startMs), e.getMessage(), null);
            throw e;
        } catch (Exception e) {
            failJob(job, e.getMessage());
            writeCallLog(userId, jobType, null, null, prompt, "failed",
                    (int) (System.currentTimeMillis() - startMs), e.getMessage(), null);
            throw new BusinessException(502, "图像生成失败: " + e.getMessage());
        }
    }

    public List<GenerationJobVO> listByTaskId(Long userId, Long taskId) {
        return generationJobMapper.selectList(
                new LambdaQueryWrapper<GenerationJob>()
                        .eq(GenerationJob::getUserId, userId)
                        .eq(GenerationJob::getRefTaskId, taskId)
                        .orderByDesc(GenerationJob::getCreatedAt)
        ).stream().map(j -> toVO(j, parseCandidates(j.getCandidatesJson()))).collect(Collectors.toList());
    }

    private AssetService.ProviderImageRef resolveReferenceForJob(String sourceUrl, Long userId) {
        return assetService.resolveReferenceImageForProvider(sourceUrl, userId);
    }

    private void failJob(GenerationJob job, String message) {
        job.setStatus("failed");
        job.setErrorMessage(message != null && message.length() > 500 ? message.substring(0, 500) : message);
        job.setUpdatedAt(LocalDateTime.now());
        generationJobMapper.updateById(job);
    }

    private void writeCallLog(Long userId, String scene, String provider, String model, String prompt,
                              String status, int costMs, String summary, Integer imageCount) {
        aiCallLogService.logCall(userId, scene, provider, model, prompt, status, costMs, summary,
                null, null, null, imageCount);
    }

    private static String resolveImageModel(PythonImageGenerateResponse resp) {
        if (resp.getModel() != null && !resp.getModel().isBlank()) {
            return resp.getModel();
        }
        if ("dashscope_wanx".equals(resp.getProvider())) {
            return "wan2.7-image-pro";
        }
        if ("seedream".equals(resp.getProvider())) {
            return "doubao-seedream-5-0-260128";
        }
        return resp.getProvider();
    }

    private String writeJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            throw new BusinessException(500, "JSON 序列化失败");
        }
    }

    @SuppressWarnings("unchecked")
    private List<ImageCandidateVO> parseCandidates(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            List<Map<String, Object>> list = objectMapper.readValue(json, List.class);
            return list.stream().map(m -> {
                ImageCandidateVO vo = new ImageCandidateVO();
                vo.setUrl(String.valueOf(m.get("url")));
                Object idx = m.get("index");
                vo.setIndex(idx instanceof Number ? ((Number) idx).intValue() : 0);
                return vo;
            }).collect(Collectors.toList());
        } catch (JsonProcessingException e) {
            return List.of();
        }
    }

    private GenerationJobVO toVO(GenerationJob job, List<?> candidates) {
        GenerationJobVO vo = new GenerationJobVO();
        vo.setId(job.getId());
        vo.setJobType(job.getJobType());
        vo.setStatus(job.getStatus());
        vo.setProviderUsed(job.getProviderUsed());
        vo.setErrorMessage(job.getErrorMessage());
        vo.setCreatedAt(job.getCreatedAt());
        if (candidates != null && !candidates.isEmpty() && candidates.get(0) instanceof PythonImageCandidate pic) {
            vo.setCandidates(candidates.stream().map(c -> {
                PythonImageCandidate p = (PythonImageCandidate) c;
                ImageCandidateVO ic = new ImageCandidateVO();
                ic.setUrl(p.getUrl());
                ic.setIndex(p.getIndex());
                return ic;
            }).collect(Collectors.toList()));
        } else if (candidates != null && !candidates.isEmpty() && candidates.get(0) instanceof ImageCandidateVO) {
            @SuppressWarnings("unchecked")
            List<ImageCandidateVO> list = (List<ImageCandidateVO>) candidates;
            vo.setCandidates(list);
        } else {
            vo.setCandidates(parseCandidates(job.getCandidatesJson()));
        }
        return vo;
    }
}
