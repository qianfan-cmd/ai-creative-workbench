package com.workbench.backendjava.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.workbench.backendjava.client.PythonAiClient;
import com.workbench.backendjava.client.PythonAiClient.PythonImageCandidate;
import com.workbench.backendjava.client.PythonAiClient.PythonImageGenerateResponse;
import com.workbench.backendjava.common.BusinessException;
import com.workbench.backendjava.entity.AiCallLog;
import com.workbench.backendjava.entity.OpsMattingTask;
import com.workbench.backendjava.entity.PromptTemplate;
import com.workbench.backendjava.mapper.AiCallLogMapper;
import com.workbench.backendjava.mapper.OpsMattingTaskMapper;
import com.workbench.backendjava.mapper.PromptTemplateMapper;
import com.workbench.backendjava.model.MattingConfig;
import com.workbench.backendjava.model.MattingConfig.ConfirmedSource;
import com.workbench.backendjava.model.MattingConfig.CropRegion;
import com.workbench.backendjava.model.MattingConfig.ElementImage;
import com.workbench.backendjava.model.MattingConfig.ElementItem;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

/** 抠图元素异步提取 — group + single 两阶段（对齐美术机台） */
@Slf4j
@Service
@RequiredArgsConstructor
public class MattingExtractService {

    private final OpsMattingTaskMapper mattingTaskMapper;
    private final PromptTemplateMapper promptTemplateMapper;
    private final PythonAiClient pythonAiClient;
    private final AssetService assetService;
    private final MattingImageCropService mattingImageCropService;
    private final AiCallLogMapper aiCallLogMapper;
    private final ObjectMapper objectMapper;

    private final ExecutorService executor = Executors.newFixedThreadPool(4);

    public void runExtractAsync(Long taskId, Long userId, MattingConfig config, int candidateCount, String sourceUrl) {
        CompletableFuture.runAsync(() -> doExtract(taskId, userId, config, candidateCount, sourceUrl), executor);
    }

    public void runRegenerateAsync(Long taskId, Long userId, String elementId, int slotIndex, String sourceUrl) {
        CompletableFuture.runAsync(() -> doRegenerate(taskId, userId, elementId, slotIndex, sourceUrl), executor);
    }

    private void doExtract(Long taskId, Long userId, MattingConfig config, int candidateCount, String sourceUrl) {
        try {
            List<ElementItem> checked = config.getElements().stream()
                    .filter(e -> Boolean.TRUE.equals(e.getChecked()))
                    .collect(Collectors.toList());
            if (checked.isEmpty()) {
                failExtract(taskId, userId, "请至少勾选一个元素");
                return;
            }

            Map<String, List<ElementItem>> byRegion = checked.stream()
                    .collect(Collectors.groupingBy(ElementItem::getRegionId, LinkedHashMap::new, Collectors.toList()));

            config.getElementImages().removeIf(img ->
                    checked.stream().anyMatch(e -> e.getId().equals(img.getElementId())));

            for (ElementItem el : checked) {
                for (int slot = 0; slot < candidateCount; slot++) {
                    ElementImage pending = new ElementImage();
                    pending.setElementId(el.getId());
                    pending.setElementName(el.getElementName());
                    pending.setSlotIndex(slot);
                    pending.setStatus("pending");
                    pending.setSelected(slot == 0);
                    config.getElementImages().add(pending);
                }
            }
            saveConfig(taskId, userId, config);

            for (Map.Entry<String, List<ElementItem>> regionEntry : byRegion.entrySet()) {
                String regionId = regionEntry.getKey();
                List<ElementItem> regionElements = regionEntry.getValue();
                String regionSourceUrl = resolveRegionImageUrl(config, regionId, userId, sourceUrl);
                byte[] regionImageBytes = resolveRegionImageBytes(config, regionId, userId);
                if (regionSourceUrl == null && (regionImageBytes == null || regionImageBytes.length == 0)) {
                    markRegionFailed(config, regionElements, "区域图片不可用");
                    saveConfig(taskId, userId, config);
                    continue;
                }

                Map<String, List<ElementItem>> byGroup = regionElements.stream()
                        .collect(Collectors.groupingBy(ElementItem::getGroupName, LinkedHashMap::new, Collectors.toList()));

                for (Map.Entry<String, List<ElementItem>> groupEntry : byGroup.entrySet()) {
                    String groupName = groupEntry.getKey();
                    List<ElementItem> groupElements = groupEntry.getValue();
                    List<String> targetNames = groupElements.stream().map(ElementItem::getElementName).collect(Collectors.toList());
                    List<String> nonTargetNames = config.getElements().stream()
                            .filter(e -> regionId.equals(e.getRegionId()))
                            .filter(e -> !groupName.equals(e.getGroupName()))
                            .map(ElementItem::getElementName)
                            .collect(Collectors.toList());

                    String groupPrompt = renderTemplate("matting_extract", Map.of(
                            "nonTargetNames", String.join("、", nonTargetNames),
                            "targetNames", String.join("、", targetNames)
                    ));

                    String groupImageUrl;
                    try {
                        groupImageUrl = extractGroupImage(userId, regionSourceUrl, regionImageBytes, groupPrompt);
                    } catch (Exception e) {
                        log.error("分组提取失败 region={} group={}", regionId, groupName, e);
                        markGroupFailed(config, groupElements, e.getMessage());
                        saveConfig(taskId, userId, config);
                        continue;
                    }

                    for (ElementItem element : groupElements) {
                        List<String> nonTargetInGroup = groupElements.stream()
                                .filter(e -> !e.getId().equals(element.getId()))
                                .map(ElementItem::getElementName)
                                .collect(Collectors.toList());
                        String singlePrompt = renderTemplate("matting_single", Map.of(
                                "targetElementName", element.getElementName(),
                                "nonTargetNames", String.join("、", nonTargetInGroup)
                        ));

                        for (int slot = 0; slot < candidateCount; slot++) {
                            ElementImage img = findImage(config, element.getId(), slot);
                            extractSingleSlot(taskId, userId, config, element, slot, groupImageUrl, singlePrompt, img);
                            saveConfig(taskId, userId, config);
                        }
                    }
                }
            }

            MattingConfig finalConfig = parseConfig(loadTask(taskId, userId).getConfigJson());
            finalConfig.setExtractStatus("done");
            finalConfig.setExtractError(null);
            updateTaskFields(taskId, userId, finalConfig, "done", 4);
        } catch (Exception e) {
            log.error("抠图提取任务失败 taskId={}", taskId, e);
            failExtract(taskId, userId, truncate(e.getMessage(), 400));
        }
    }

    private void doRegenerate(Long taskId, Long userId, String elementId, int slotIndex, String sourceUrl) {
        try {
            OpsMattingTask task = loadTask(taskId, userId);
            MattingConfig config = parseConfig(task.getConfigJson());

            ElementItem element = config.getElements().stream()
                    .filter(e -> elementId.equals(e.getId()))
                    .findFirst()
                    .orElse(null);
            if (element == null) {
                finishRegenerate(taskId, userId, "元素不存在");
                return;
            }

            ElementImage img = findImage(config, elementId, slotIndex);
            if (img == null) {
                finishRegenerate(taskId, userId, "候选槽位不存在");
                return;
            }

            String regionId = element.getRegionId();
            String groupName = element.getGroupName();
            String regionSourceUrl = resolveRegionImageUrl(config, regionId, userId, sourceUrl);
            byte[] regionImageBytes = resolveRegionImageBytes(config, regionId, userId);
            if (regionSourceUrl == null && (regionImageBytes == null || regionImageBytes.length == 0)) {
                img.setStatus("failed");
                img.setErrorMessage("区域图片不可用");
                finishRegenerate(taskId, userId, config);
                return;
            }

            List<ElementItem> groupElements = config.getElements().stream()
                    .filter(e -> regionId.equals(e.getRegionId()))
                    .filter(e -> groupName.equals(e.getGroupName()))
                    .filter(e -> Boolean.TRUE.equals(e.getChecked()))
                    .collect(Collectors.toList());

            List<String> targetNames = groupElements.stream().map(ElementItem::getElementName).collect(Collectors.toList());
            List<String> nonTargetNames = config.getElements().stream()
                    .filter(e -> regionId.equals(e.getRegionId()))
                    .filter(e -> !groupName.equals(e.getGroupName()))
                    .map(ElementItem::getElementName)
                    .collect(Collectors.toList());

            String groupPrompt = renderTemplate("matting_extract", Map.of(
                    "nonTargetNames", String.join("、", nonTargetNames),
                    "targetNames", String.join("、", targetNames)
            ));

            String groupImageUrl;
            try {
                groupImageUrl = extractGroupImage(userId, regionSourceUrl, regionImageBytes, groupPrompt);
            } catch (Exception e) {
                log.error("再生成分组提取失败 element={}", element.getElementName(), e);
                img.setStatus("failed");
                img.setErrorMessage(truncate(e.getMessage(), 200));
                finishRegenerate(taskId, userId, config);
                return;
            }

            List<String> nonTargetInGroup = groupElements.stream()
                    .filter(e -> !e.getId().equals(element.getId()))
                    .map(ElementItem::getElementName)
                    .collect(Collectors.toList());
            String singlePrompt = renderTemplate("matting_single", Map.of(
                    "targetElementName", element.getElementName(),
                    "nonTargetNames", String.join("、", nonTargetInGroup)
            ));

            extractSingleSlot(taskId, userId, config, element, slotIndex, groupImageUrl, singlePrompt, img);
            finishRegenerate(taskId, userId, config);
        } catch (Exception e) {
            log.error("单元素再生成失败 taskId={} elementId={}", taskId, elementId, e);
            try {
                OpsMattingTask task = loadTask(taskId, userId);
                MattingConfig config = parseConfig(task.getConfigJson());
                ElementImage img = findImage(config, elementId, slotIndex);
                if (img != null) {
                    img.setStatus("failed");
                    img.setErrorMessage(truncate(e.getMessage(), 200));
                }
                finishRegenerate(taskId, userId, config);
            } catch (Exception ex) {
                log.error("更新再生成失败状态出错", ex);
            }
        }
    }

    private void finishRegenerate(Long taskId, Long userId, MattingConfig config) {
        config.setExtractStatus("done");
        config.setExtractError(null);
        saveConfig(taskId, userId, config);
    }

    private void finishRegenerate(Long taskId, Long userId, String errorMessage) {
        try {
            OpsMattingTask task = loadTask(taskId, userId);
            MattingConfig config = parseConfig(task.getConfigJson());
            config.setExtractStatus("done");
            config.setExtractError(errorMessage);
            saveConfig(taskId, userId, config);
        } catch (Exception ex) {
            log.error("更新再生成结束状态出错", ex);
        }
    }

    private String extractGroupImage(Long userId, String regionSourceUrl, byte[] regionImageBytes, String groupPrompt)
            throws Exception {
        long t0 = System.currentTimeMillis();
        PythonImageGenerateResponse groupResp = pythonAiClient.opsExtractElement(
                regionSourceUrl, groupPrompt, 1, regionImageBytes);
        writeLog(userId, "matting_extract", groupResp.getProvider(), groupPrompt,
                "success", (int) (System.currentTimeMillis() - t0), "group image");
        return groupResp.getCandidates().get(0).getUrl();
    }

    private void extractSingleSlot(Long taskId, Long userId, MattingConfig config, ElementItem element, int slot,
                                   String groupImageUrl, String singlePrompt, ElementImage img) {
        if (img == null) {
            return;
        }
        try {
            long t0 = System.currentTimeMillis();
            PythonImageGenerateResponse singleResp = pythonAiClient.opsExtractElement(
                    groupImageUrl, singlePrompt, 1);
            writeLog(userId, "matting_single", singleResp.getProvider(), singlePrompt,
                    "success", (int) (System.currentTimeMillis() - t0), element.getElementName());
            PythonImageCandidate cand = singleResp.getCandidates().get(0);
            String safeElementId = element.getId().replaceAll("[^a-zA-Z0-9_-]", "_");
            String persisted = assetService.persistProviderImage(
                    cand.getUrl(),
                    "matting/" + taskId,
                    "candidate-" + safeElementId + "-slot" + slot);
            img.setUrl(persisted);
            img.setStatus("done");
        } catch (Exception e) {
            log.error("单体提取失败 element={} slot={}", element.getElementName(), slot, e);
            img.setStatus("failed");
            img.setErrorMessage(truncate(e.getMessage(), 200));
        }
    }

    private void failExtract(Long taskId, Long userId, String message) {
        try {
            OpsMattingTask task = loadTask(taskId, userId);
            MattingConfig config = parseConfig(task.getConfigJson());
            config.setExtractStatus("failed");
            config.setExtractError(message);
            mattingTaskMapper.update(null, new LambdaUpdateWrapper<OpsMattingTask>()
                    .eq(OpsMattingTask::getId, taskId)
                    .eq(OpsMattingTask::getUserId, userId)
                    .set(OpsMattingTask::getConfigJson, writeJson(config))
                    .set(OpsMattingTask::getStatus, "draft")
                    .set(OpsMattingTask::getUpdatedAt, LocalDateTime.now()));
        } catch (Exception ex) {
            log.error("更新提取失败状态出错", ex);
        }
    }

    private void markGroupFailed(MattingConfig config, List<ElementItem> elements, String msg) {
        for (ElementItem el : elements) {
            for (ElementImage img : config.getElementImages()) {
                if (el.getId().equals(img.getElementId())) {
                    img.setStatus("failed");
                    img.setErrorMessage(truncate(msg, 200));
                }
            }
        }
    }

    private void markRegionFailed(MattingConfig config, List<ElementItem> elements, String msg) {
        markGroupFailed(config, elements, msg);
    }

    private ElementImage findImage(MattingConfig config, String elementId, int slot) {
        return config.getElementImages().stream()
                .filter(i -> elementId.equals(i.getElementId()) && slot == (i.getSlotIndex() != null ? i.getSlotIndex() : 0))
                .findFirst().orElse(null);
    }

    private String resolveRegionImageUrl(MattingConfig config, String regionId, Long userId, String fallbackSourceUrl) {
        CropRegion region = config.getCropRegions().stream()
                .filter(r -> regionId.equals(r.getId()))
                .findFirst().orElse(null);
        if (region == null) return fallbackSourceUrl;

        String sourceUrl = fallbackSourceUrl;
        if (region.getSourceId() != null && config.getConfirmedSources() != null) {
            for (com.workbench.backendjava.model.MattingConfig.ConfirmedSource cs : config.getConfirmedSources()) {
                if (region.getSourceId().equals(cs.getId())) {
                    if (cs.getSourceAssetId() != null) {
                        try {
                            sourceUrl = assetService.getPublicUrlForOwnedAsset(cs.getSourceAssetId(), userId);
                        } catch (BusinessException ignored) {
                            /* fall through */
                        }
                    }
                    if ((sourceUrl == null || sourceUrl.equals(fallbackSourceUrl))
                            && cs.getSourceImageUrl() != null && !cs.getSourceImageUrl().isBlank()) {
                        sourceUrl = cs.getSourceImageUrl();
                    }
                    break;
                }
            }
        }

        if (Boolean.TRUE.equals(region.getUseOriginal())) {
            return sourceUrl;
        }
        if (region.getSubAssetId() != null) {
            try {
                return assetService.getPublicUrlForOwnedAsset(region.getSubAssetId(), userId);
            } catch (BusinessException ignored) {
                /* fall through */
            }
        }
        if (region.getSubAssetUrl() != null && !region.getSubAssetUrl().isBlank()) {
            if (region.getSubAssetUrl().startsWith("http://") || region.getSubAssetUrl().startsWith("https://")) {
                return region.getSubAssetUrl();
            }
            return assetService.buildPublicUrlFromStoredPath(region.getSubAssetUrl());
        }
        return sourceUrl;
    }

    /** 供元素提取 L2 inline base64：优先 subAsset，useOriginal 读整图源图 */
    private byte[] resolveRegionImageBytes(MattingConfig config, String regionId, Long userId) {
        CropRegion region = config.getCropRegions().stream()
                .filter(r -> regionId.equals(r.getId()))
                .findFirst().orElse(null);
        if (region == null) {
            return null;
        }
        if (Boolean.TRUE.equals(region.getUseOriginal())) {
            ConfirmedSource source = findConfirmedSource(config, region.getSourceId());
            if (source == null) {
                return null;
            }
            return mattingImageCropService.readSourceBytes(userId, source);
        }
        if (region.getSubAssetId() != null) {
            try {
                return assetService.readOwnedAssetBytes(region.getSubAssetId(), userId);
            } catch (BusinessException ignored) {
                /* fall through */
            }
        }
        if (region.getSubAssetUrl() != null && !region.getSubAssetUrl().isBlank()) {
            if (region.getSubAssetUrl().startsWith("http://") || region.getSubAssetUrl().startsWith("https://")) {
                return assetService.downloadImageBytes(region.getSubAssetUrl());
            }
            return assetService.readWorkflowImageBytes(region.getSubAssetUrl());
        }
        return null;
    }

    private ConfirmedSource findConfirmedSource(MattingConfig config, String sourceId) {
        if (config.getConfirmedSources() == null || sourceId == null) {
            return null;
        }
        return config.getConfirmedSources().stream()
                .filter(cs -> sourceId.equals(cs.getId()))
                .findFirst()
                .orElse(null);
    }

    private String renderTemplate(String scene, Map<String, String> vars) {
        PromptTemplate template = promptTemplateMapper.selectOne(
                new LambdaQueryWrapper<PromptTemplate>()
                        .eq(PromptTemplate::getScene, scene)
                        .isNull(PromptTemplate::getUserId)
                        .last("LIMIT 1")
        );
        if (template == null) {
            throw new BusinessException(500, "未找到 prompt 模板: " + scene);
        }
        String content = template.getContent();
        for (Map.Entry<String, String> e : vars.entrySet()) {
            content = content.replace("{{" + e.getKey() + "}}", e.getValue() != null ? e.getValue() : "");
        }
        return content;
    }

    private void saveConfig(Long taskId, Long userId, MattingConfig config) {
        loadTask(taskId, userId);
        mattingTaskMapper.update(null, new LambdaUpdateWrapper<OpsMattingTask>()
                .eq(OpsMattingTask::getId, taskId)
                .eq(OpsMattingTask::getUserId, userId)
                .set(OpsMattingTask::getConfigJson, writeJson(config))
                .set(OpsMattingTask::getUpdatedAt, LocalDateTime.now()));
    }

    private void updateTaskFields(Long taskId, Long userId, MattingConfig config, String status, Integer stage) {
        mattingTaskMapper.update(null, new LambdaUpdateWrapper<OpsMattingTask>()
                .eq(OpsMattingTask::getId, taskId)
                .eq(OpsMattingTask::getUserId, userId)
                .set(OpsMattingTask::getConfigJson, writeJson(config))
                .set(OpsMattingTask::getStatus, status)
                .set(OpsMattingTask::getStage, stage)
                .set(OpsMattingTask::getUpdatedAt, LocalDateTime.now()));
    }

    private OpsMattingTask loadTask(Long taskId, Long userId) {
        OpsMattingTask task = mattingTaskMapper.selectById(taskId);
        if (task == null || !userId.equals(task.getUserId())) {
            throw new BusinessException(404, "任务不存在");
        }
        return task;
    }

    private MattingConfig parseConfig(String json) {
        if (json == null || json.isBlank()) {
            return new MattingConfig();
        }
        try {
            return objectMapper.readValue(json, MattingConfig.class);
        } catch (JsonProcessingException e) {
            return new MattingConfig();
        }
    }

    private String writeJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            throw new BusinessException(500, "JSON 序列化失败");
        }
    }

    private void writeLog(Long userId, String scene, String provider, String prompt,
                          String status, int costMs, String summary) {
        AiCallLog row = new AiCallLog();
        row.setUserId(userId);
        row.setScene(scene);
        row.setProvider(provider);
        row.setPrompt(prompt != null && prompt.length() > 2000 ? prompt.substring(0, 2000) : prompt);
        row.setStatus(status);
        row.setCostMs(costMs);
        row.setResponseSummary(truncate(summary, 500));
        row.setCreatedAt(LocalDateTime.now());
        aiCallLogMapper.insert(row);
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() > max ? s.substring(0, max) : s;
    }
}
