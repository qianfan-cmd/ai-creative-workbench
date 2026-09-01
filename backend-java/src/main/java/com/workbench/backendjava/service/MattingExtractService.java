package com.workbench.backendjava.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
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
    private final AiCallLogMapper aiCallLogMapper;
    private final ObjectMapper objectMapper;

    private final ExecutorService executor = Executors.newFixedThreadPool(4);

    public void runExtractAsync(Long taskId, Long userId, MattingConfig config, int candidateCount, String sourceUrl) {
        CompletableFuture.runAsync(() -> doExtract(taskId, userId, config, candidateCount, sourceUrl), executor);
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
                if (regionSourceUrl == null) {
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
                        long t0 = System.currentTimeMillis();
                        PythonImageGenerateResponse groupResp = pythonAiClient.opsExtractElement(
                                regionSourceUrl, groupPrompt, 1);
                        writeLog(userId, "matting_extract", groupResp.getProvider(), groupPrompt,
                                "success", (int) (System.currentTimeMillis() - t0), "group image");
                        groupImageUrl = groupResp.getCandidates().get(0).getUrl();
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
                            try {
                                long t0 = System.currentTimeMillis();
                                PythonImageGenerateResponse singleResp = pythonAiClient.opsExtractElement(
                                        groupImageUrl, singlePrompt, 1);
                                writeLog(userId, "matting_single", singleResp.getProvider(), singlePrompt,
                                        "success", (int) (System.currentTimeMillis() - t0), element.getElementName());
                                PythonImageCandidate cand = singleResp.getCandidates().get(0);
                                if (img != null) {
                                    img.setUrl(cand.getUrl());
                                    img.setStatus("done");
                                }
                            } catch (Exception e) {
                                log.error("单体提取失败 element={} slot={}", element.getElementName(), slot, e);
                                if (img != null) {
                                    img.setStatus("failed");
                                    img.setErrorMessage(truncate(e.getMessage(), 200));
                                }
                            }
                            saveConfig(taskId, userId, config);
                        }
                    }
                }
            }

            OpsMattingTask task = loadTask(taskId, userId);
            MattingConfig finalConfig = parseConfig(task.getConfigJson());
            finalConfig.setExtractStatus("done");
            finalConfig.setExtractError(null);
            task.setStatus("done");
            task.setStage(4);
            task.setConfigJson(writeJson(finalConfig));
            task.setUpdatedAt(LocalDateTime.now());
            mattingTaskMapper.updateById(task);
        } catch (Exception e) {
            log.error("抠图提取任务失败 taskId={}", taskId, e);
            failExtract(taskId, userId, truncate(e.getMessage(), 400));
        }
    }

    private void failExtract(Long taskId, Long userId, String message) {
        try {
            OpsMattingTask task = loadTask(taskId, userId);
            MattingConfig config = parseConfig(task.getConfigJson());
            config.setExtractStatus("failed");
            config.setExtractError(message);
            task.setConfigJson(writeJson(config));
            task.setStatus("draft");
            task.setUpdatedAt(LocalDateTime.now());
            mattingTaskMapper.updateById(task);
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
            return assetService.getPublicUrlForOwnedAsset(region.getSubAssetId(), userId);
        }
        if (region.getSubAssetUrl() != null && !region.getSubAssetUrl().isBlank()) {
            return region.getSubAssetUrl();
        }
        return sourceUrl;
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
        OpsMattingTask task = loadTask(taskId, userId);
        task.setConfigJson(writeJson(config));
        task.setUpdatedAt(LocalDateTime.now());
        mattingTaskMapper.updateById(task);
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
