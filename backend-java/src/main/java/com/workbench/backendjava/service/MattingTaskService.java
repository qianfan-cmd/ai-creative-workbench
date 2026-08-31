package com.workbench.backendjava.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.workbench.backendjava.client.PythonAiClient;
import com.workbench.backendjava.common.BusinessException;
import com.workbench.backendjava.common.LoginUserContext;
import com.workbench.backendjava.dto.MattingCropSaveRequest;
import com.workbench.backendjava.dto.MattingElementsPatchRequest;
import com.workbench.backendjava.dto.MattingElementsSaveRequest;
import com.workbench.backendjava.dto.MattingExtractConfirmRequest;
import com.workbench.backendjava.dto.MattingGenerateRequest;
import com.workbench.backendjava.dto.MattingSaveRequest;
import com.workbench.backendjava.dto.MattingTaskCreateRequest;
import com.workbench.backendjava.dto.MattingTaskPatchRequest;
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
import com.workbench.backendjava.vo.AssetVO;
import com.workbench.backendjava.vo.GenerationJobVO;
import com.workbench.backendjava.vo.MattingElementsVO;
import com.workbench.backendjava.vo.MattingExtractStatusVO;
import com.workbench.backendjava.vo.MattingTaskVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/** 抠图任务 CRUD + 框选/识别/提取/保存编排 */
@Service
@RequiredArgsConstructor
public class MattingTaskService {

    private static final int MAX_REGIONS = 6;

    private final OpsMattingTaskMapper mattingTaskMapper;
    private final AssetService assetService;
    private final GenerationJobService generationJobService;
    private final MattingExtractService mattingExtractService;
    private final PromptTemplateMapper promptTemplateMapper;
    private final PythonAiClient pythonAiClient;
    private final AiCallLogMapper aiCallLogMapper;
    private final ObjectMapper objectMapper;

    public List<MattingTaskVO> listTasks() {
        Long userId = requireUserId();
        return mattingTaskMapper.selectList(
                new LambdaQueryWrapper<OpsMattingTask>()
                        .eq(OpsMattingTask::getUserId, userId)
                        .orderByDesc(OpsMattingTask::getUpdatedAt)
        ).stream().map(this::toVO).collect(Collectors.toList());
    }

    @Transactional
    public MattingTaskVO createTask(MattingTaskCreateRequest request) {
        Long userId = requireUserId();
        OpsMattingTask task = new OpsMattingTask();
        task.setUserId(userId);
        task.setTitle(request.getTitle().trim());
        task.setStage(1);
        task.setStatus("draft");
        task.setCreatedAt(LocalDateTime.now());
        task.setUpdatedAt(LocalDateTime.now());
        mattingTaskMapper.insert(task);
        return toVO(task);
    }

    public MattingTaskVO getTask(Long id) {
        return toVO(getOwnedTask(id, requireUserId()));
    }

    @Transactional
    public MattingTaskVO patchTask(Long id, MattingTaskPatchRequest request) {
        Long userId = requireUserId();
        OpsMattingTask task = getOwnedTask(id, userId);
        if (request.getTitle() != null) {
            task.setTitle(request.getTitle().trim());
        }
        if (request.getStage() != null) {
            task.setStage(request.getStage());
        }
        if (request.getSourceAssetId() != null) {
            task.setSourceAssetId(request.getSourceAssetId());
        }
        if (request.getConfigJson() != null) {
            task.setConfigJson(request.getConfigJson());
        }
        if (request.getSelectedCandidate() != null) {
            task.setSelectedCandidate(request.getSelectedCandidate());
        }
        if (request.getStatus() != null) {
            task.setStatus(request.getStatus());
        }
        task.setUpdatedAt(LocalDateTime.now());
        mattingTaskMapper.updateById(task);
        return toVO(task);
    }

    @Transactional
    public MattingTaskVO saveCropRegions(Long taskId, MattingCropSaveRequest request) {
        Long userId = requireUserId();
        OpsMattingTask task = getOwnedTask(taskId, userId);
        if (task.getSourceAssetId() == null) {
            throw new BusinessException(400, "请先选择源图");
        }

        MattingConfig config = parseConfig(task.getConfigJson());
        config.setCropRegions(new ArrayList<>());

        if (Boolean.TRUE.equals(request.getUseOriginal())) {
            CropRegion region = new CropRegion();
            region.setId("r_original");
            region.setUseOriginal(true);
            config.getCropRegions().add(region);
        } else {
            List<MattingCropSaveRequest.CropRegionItem> items = request.getRegions();
            if (items == null || items.isEmpty()) {
                throw new BusinessException(400, "请至少框选一个区域，或选择使用原图");
            }
            if (items.size() > MAX_REGIONS) {
                throw new BusinessException(400, "最多 " + MAX_REGIONS + " 个切割区域");
            }
            for (MattingCropSaveRequest.CropRegionItem item : items) {
                CropRegion region = new CropRegion();
                region.setId(item.getId() != null ? item.getId() : "r_" + UUID.randomUUID().toString().substring(0, 8));
                region.setXPct(item.getXPct());
                region.setYPct(item.getYPct());
                region.setWPct(item.getWPct());
                region.setHPct(item.getHPct());
                region.setSubAssetId(item.getSubAssetId());
                if (item.getSubAssetId() != null) {
                    region.setSubAssetUrl(assetService.getPublicUrlForOwnedAsset(item.getSubAssetId(), userId));
                }
                region.setUseOriginal(false);
                config.getCropRegions().add(region);
            }
        }

        task.setConfigJson(writeJson(config));
        task.setStage(2);
        task.setUpdatedAt(LocalDateTime.now());
        mattingTaskMapper.updateById(task);
        return toVO(task);
    }

    @Transactional
    public MattingTaskVO confirmCrop(Long taskId) {
        Long userId = requireUserId();
        OpsMattingTask task = getOwnedTask(taskId, userId);
        if (task.getSourceAssetId() == null) {
            throw new BusinessException(400, "请先选择源图");
        }
        String sourceUrl = assetService.getPublicUrlForOwnedAsset(task.getSourceAssetId(), userId);
        MattingConfig config = parseConfig(task.getConfigJson());

        if (config.getCropRegions().isEmpty()) {
            throw new BusinessException(400, "请先保存框选区域");
        }

        config.setDetectStatus("running");
        config.setDetectError(null);
        config.setElements(new ArrayList<>());
        task.setConfigJson(writeJson(config));
        task.setStatus("running");
        mattingTaskMapper.updateById(task);

        String regionPrompt = loadPromptTemplate("matting_region");
        int sort = 0;

        try {
            for (CropRegion region : config.getCropRegions()) {
                String imageUrl = resolveRegionImageUrl(region, sourceUrl, userId);
                long t0 = System.currentTimeMillis();
                Map<String, List<String>> groups = pythonAiClient.opsDetectElements(imageUrl, regionPrompt);
                writeDetectLog(userId, "matting_detect", regionPrompt, "success",
                        (int) (System.currentTimeMillis() - t0), region.getId());

                for (Map.Entry<String, List<String>> entry : groups.entrySet()) {
                    for (String name : entry.getValue()) {
                        ElementItem el = new ElementItem();
                        el.setId("e_" + UUID.randomUUID().toString().substring(0, 8));
                        el.setRegionId(region.getId());
                        el.setGroupName(entry.getKey());
                        el.setElementName(name);
                        el.setChecked(true);
                        el.setSortOrder(sort++);
                        el.setCreateType("ai_identified");
                        config.getElements().add(el);
                    }
                }
            }
            config.setDetectStatus("done");
            task.setStage(3);
            task.setStatus("draft");
        } catch (Exception e) {
            config.setDetectStatus("failed");
            config.setDetectError(truncate(e.getMessage(), 400));
            task.setStatus("draft");
            throw new BusinessException(502, config.getDetectError());
        } finally {
            task.setConfigJson(writeJson(config));
            task.setUpdatedAt(LocalDateTime.now());
            mattingTaskMapper.updateById(task);
        }
        return toVO(task);
    }

    @Transactional
    public MattingTaskVO reDetectRegion(Long taskId, String regionId) {
        Long userId = requireUserId();
        OpsMattingTask task = getOwnedTask(taskId, userId);
        String sourceUrl = assetService.getPublicUrlForOwnedAsset(task.getSourceAssetId(), userId);
        MattingConfig config = parseConfig(task.getConfigJson());

        CropRegion region = config.getCropRegions().stream()
                .filter(r -> regionId.equals(r.getId()))
                .findFirst()
                .orElseThrow(() -> new BusinessException(404, "区域不存在"));

        config.getElements().removeIf(e -> regionId.equals(e.getRegionId()));
        config.setDetectStatus("running");
        task.setConfigJson(writeJson(config));
        mattingTaskMapper.updateById(task);

        String regionPrompt = loadPromptTemplate("matting_region");
        try {
            String imageUrl = resolveRegionImageUrl(region, sourceUrl, userId);
            Map<String, List<String>> groups = pythonAiClient.opsDetectElements(imageUrl, regionPrompt);
            int sort = config.getElements().stream()
                    .mapToInt(e -> e.getSortOrder() != null ? e.getSortOrder() : 0)
                    .max().orElse(-1) + 1;
            for (Map.Entry<String, List<String>> entry : groups.entrySet()) {
                for (String name : entry.getValue()) {
                    ElementItem el = new ElementItem();
                    el.setId("e_" + UUID.randomUUID().toString().substring(0, 8));
                    el.setRegionId(regionId);
                    el.setGroupName(entry.getKey());
                    el.setElementName(name);
                    el.setChecked(true);
                    el.setSortOrder(sort++);
                    el.setCreateType("ai_identified");
                    config.getElements().add(el);
                }
            }
            config.setDetectStatus("done");
            config.setDetectError(null);
        } catch (Exception e) {
            config.setDetectStatus("failed");
            config.setDetectError(truncate(e.getMessage(), 400));
            throw new BusinessException(502, config.getDetectError());
        } finally {
            task.setConfigJson(writeJson(config));
            task.setUpdatedAt(LocalDateTime.now());
            mattingTaskMapper.updateById(task);
        }
        return toVO(task);
    }

    public MattingElementsVO getElements(Long taskId) {
        OpsMattingTask task = getOwnedTask(taskId, requireUserId());
        MattingConfig config = parseConfig(task.getConfigJson());
        return buildElementsVO(config, task.getUserId());
    }

    @Transactional
    public MattingElementsVO patchElements(Long taskId, MattingElementsPatchRequest request) {
        Long userId = requireUserId();
        OpsMattingTask task = getOwnedTask(taskId, userId);
        MattingConfig config = parseConfig(task.getConfigJson());
        if (request.getElements() == null) {
            return buildElementsVO(config, userId);
        }
        for (MattingElementsPatchRequest.ElementPatch patch : request.getElements()) {
            if (Boolean.TRUE.equals(patch.getDeleted())) {
                config.getElements().removeIf(e -> patch.getId().equals(e.getId()));
                continue;
            }
            config.getElements().stream()
                    .filter(e -> patch.getId().equals(e.getId()))
                    .findFirst()
                    .ifPresent(el -> {
                        if (patch.getElementName() != null) {
                            el.setElementName(patch.getElementName().trim());
                        }
                        if (patch.getChecked() != null) {
                            el.setChecked(patch.getChecked());
                        }
                    });
        }
        task.setConfigJson(writeJson(config));
        task.setUpdatedAt(LocalDateTime.now());
        mattingTaskMapper.updateById(task);
        return buildElementsVO(config, userId);
    }

    @Transactional
    public MattingTaskVO confirmExtract(Long taskId, MattingExtractConfirmRequest request) {
        Long userId = requireUserId();
        OpsMattingTask task = getOwnedTask(taskId, userId);
        MattingConfig config = parseConfig(task.getConfigJson());
        int count = request.getCandidateCount() != null ? request.getCandidateCount() : 2;
        if (count < 1 || count > 4) {
            throw new BusinessException(400, "候选数量需在 1–4 之间");
        }
        config.setCandidateCount(count);
        config.setExtractStatus("running");
        config.setExtractError(null);
        config.setElementImages(new ArrayList<>());
        task.setConfigJson(writeJson(config));
        task.setStage(4);
        task.setStatus("running");
        task.setUpdatedAt(LocalDateTime.now());
        mattingTaskMapper.updateById(task);

        mattingExtractService.runExtractAsync(taskId, userId, config, count,
                assetService.getPublicUrlForOwnedAsset(task.getSourceAssetId(), userId));
        return toVO(task);
    }

    public MattingExtractStatusVO getExtractStatus(Long taskId) {
        OpsMattingTask task = getOwnedTask(taskId, requireUserId());
        MattingConfig config = parseConfig(task.getConfigJson());
        return buildExtractStatusVO(config);
    }

    @Transactional
    public List<AssetVO> saveElements(Long taskId, MattingElementsSaveRequest request) {
        Long userId = requireUserId();
        OpsMattingTask task = getOwnedTask(taskId, userId);
        if (request.getItems() == null || request.getItems().isEmpty()) {
            throw new BusinessException(400, "请选择要保存的候选图");
        }
        List<AssetVO> saved = new ArrayList<>();
        for (MattingElementsSaveRequest.ElementSaveItem item : request.getItems()) {
            String name = item.getName() != null ? item.getName()
                    : task.getTitle() + "-" + item.getElementId() + ".png";
            AssetVO asset = assetService.importFromUrl(item.getCandidateUrl(), name, List.of("matted"));
            saved.add(asset);
        }
        task.setStage(5);
        task.setStatus("done");
        task.setSelectedCandidate(writeJson(saved.stream().map(a -> Map.of("assetId", a.getId(), "url", a.getUrl())).toList()));
        task.setUpdatedAt(LocalDateTime.now());
        mattingTaskMapper.updateById(task);
        return saved;
    }

    /** @deprecated 旧版单次抠图，保留兼容 */
    @Transactional
    public GenerationJobVO generate(Long taskId, MattingGenerateRequest request) {
        Long userId = requireUserId();
        OpsMattingTask task = getOwnedTask(taskId, userId);
        if (task.getSourceAssetId() == null) {
            throw new BusinessException(400, "请先选择源图");
        }
        String sourceUrl = assetService.getPublicUrlForOwnedAsset(task.getSourceAssetId(), userId);
        String prompt = resolveMattingPrompt(request.getPrompt(), task.getConfigJson());
        int count = request.getCount() != null ? request.getCount() : 4;
        task.setStatus("running");
        task.setStage(4);
        task.setUpdatedAt(LocalDateTime.now());
        mattingTaskMapper.updateById(task);
        return generationJobService.runJob(userId, "matting", taskId, null, prompt, sourceUrl, count, null);
    }

    @Transactional
    public AssetVO saveToAssets(Long taskId, MattingSaveRequest request) {
        Long userId = requireUserId();
        OpsMattingTask task = getOwnedTask(taskId, userId);
        String name = request.getName() != null ? request.getName() : task.getTitle() + "-matted.png";
        AssetVO asset = assetService.importFromUrl(request.getCandidateUrl(), name, List.of("matted"));
        task.setSelectedCandidate(writeJson(Map.of("url", request.getCandidateUrl(), "assetId", asset.getId())));
        task.setStage(5);
        task.setStatus("done");
        task.setUpdatedAt(LocalDateTime.now());
        mattingTaskMapper.updateById(task);
        return asset;
    }

    public List<GenerationJobVO> history(Long taskId) {
        getOwnedTask(taskId, requireUserId());
        return generationJobService.listByTaskId(requireUserId(), taskId);
    }

    private MattingElementsVO buildElementsVO(MattingConfig config, Long userId) {
        MattingElementsVO vo = new MattingElementsVO();
        vo.setDetectStatus(config.getDetectStatus());
        vo.setDetectError(config.getDetectError());
        vo.setCandidateCount(config.getCandidateCount());

        List<MattingElementsVO.RegionElementsVO> regions = new ArrayList<>();
        int regionIndex = 0;
        for (CropRegion region : config.getCropRegions()) {
            MattingElementsVO.RegionElementsVO rv = new MattingElementsVO.RegionElementsVO();
            rv.setRegionId(region.getId());
            rv.setRegionLabel("区域 " + (++regionIndex));
            if (region.getSubAssetId() != null) {
                try {
                    rv.setImageUrl(assetService.getPublicUrlForOwnedAsset(region.getSubAssetId(), userId));
                } catch (BusinessException ignored) {
                    rv.setImageUrl(region.getSubAssetUrl());
                }
            } else {
                rv.setImageUrl(region.getSubAssetUrl());
            }

            Map<String, List<ElementItem>> grouped = config.getElements().stream()
                    .filter(e -> region.getId().equals(e.getRegionId()))
                    .collect(Collectors.groupingBy(ElementItem::getGroupName, LinkedHashMap::new, Collectors.toList()));

            List<MattingElementsVO.GroupElementsVO> groups = new ArrayList<>();
            for (Map.Entry<String, List<ElementItem>> ge : grouped.entrySet()) {
                MattingElementsVO.GroupElementsVO gv = new MattingElementsVO.GroupElementsVO();
                gv.setGroupName(ge.getKey());
                gv.setElements(ge.getValue().stream().map(e -> {
                    MattingElementsVO.ElementRowVO row = new MattingElementsVO.ElementRowVO();
                    row.setId(e.getId());
                    row.setRegionId(e.getRegionId());
                    row.setGroupName(e.getGroupName());
                    row.setElementName(e.getElementName());
                    row.setChecked(e.getChecked());
                    row.setCreateType(e.getCreateType());
                    return row;
                }).collect(Collectors.toList()));
                groups.add(gv);
            }
            rv.setGroups(groups);
            regions.add(rv);
        }
        vo.setRegions(regions);
        return vo;
    }

    private MattingExtractStatusVO buildExtractStatusVO(MattingConfig config) {
        MattingExtractStatusVO vo = new MattingExtractStatusVO();
        vo.setExtractStatus(config.getExtractStatus());
        vo.setExtractError(config.getExtractError());
        vo.setCandidateCount(config.getCandidateCount());

        Map<String, List<ElementImage>> byElement = config.getElementImages().stream()
                .collect(Collectors.groupingBy(ElementImage::getElementId, LinkedHashMap::new, Collectors.toList()));

        List<MattingExtractStatusVO.ElementExtractVO> elements = new ArrayList<>();
        for (ElementItem el : config.getElements()) {
            if (!Boolean.TRUE.equals(el.getChecked())) continue;
            MattingExtractStatusVO.ElementExtractVO ev = new MattingExtractStatusVO.ElementExtractVO();
            ev.setElementId(el.getId());
            ev.setElementName(el.getElementName());
            ev.setGroupName(el.getGroupName());
            List<ElementImage> imgs = byElement.getOrDefault(el.getId(), List.of());
            ev.setImages(imgs.stream().map(img -> {
                MattingExtractStatusVO.ImageSlotVO slot = new MattingExtractStatusVO.ImageSlotVO();
                slot.setSlotIndex(img.getSlotIndex());
                slot.setUrl(img.getUrl());
                slot.setSelected(img.getSelected());
                slot.setStatus(img.getStatus());
                return slot;
            }).collect(Collectors.toList()));
            boolean anyPending = imgs.stream().anyMatch(i -> "pending".equals(i.getStatus()));
            boolean anyFailed = imgs.stream().anyMatch(i -> "failed".equals(i.getStatus()));
            boolean allDone = !imgs.isEmpty() && imgs.stream().allMatch(i -> "done".equals(i.getStatus()) || "failed".equals(i.getStatus()));
            if (anyPending) {
                ev.setStatus("running");
            } else if (allDone && anyFailed) {
                ev.setStatus("partial_failed");
            } else if (allDone) {
                ev.setStatus("done");
            } else {
                ev.setStatus("pending");
            }
            ev.setSelectedSlotIndex(imgs.stream()
                    .filter(i -> Boolean.TRUE.equals(i.getSelected()))
                    .map(ElementImage::getSlotIndex)
                    .findFirst().orElse(null));
            elements.add(ev);
        }
        vo.setElements(elements);
        return vo;
    }

    private String resolveRegionImageUrl(CropRegion region, String sourceUrl, Long userId) {
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

    private String loadPromptTemplate(String scene) {
        PromptTemplate template = promptTemplateMapper.selectOne(
                new LambdaQueryWrapper<PromptTemplate>()
                        .eq(PromptTemplate::getScene, scene)
                        .isNull(PromptTemplate::getUserId)
                        .last("LIMIT 1")
        );
        if (template == null) {
            throw new BusinessException(500, "未找到内置模板: " + scene);
        }
        return template.getContent();
    }

    private String resolveMattingPrompt(String overridePrompt, String configJson) {
        if (overridePrompt != null && !overridePrompt.isBlank()) {
            return overridePrompt.trim();
        }
        return loadPromptTemplate("matting");
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

    private OpsMattingTask getOwnedTask(Long id, Long userId) {
        OpsMattingTask task = mattingTaskMapper.selectById(id);
        if (task == null || !userId.equals(task.getUserId())) {
            throw new BusinessException(404, "任务不存在");
        }
        return task;
    }

    private Long requireUserId() {
        Long userId = LoginUserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(401, "未登录");
        }
        return userId;
    }

    private MattingTaskVO toVO(OpsMattingTask task) {
        MattingTaskVO vo = new MattingTaskVO();
        vo.setId(task.getId());
        vo.setTitle(task.getTitle());
        vo.setStage(task.getStage());
        vo.setStatus(task.getStatus());
        vo.setSourceAssetId(task.getSourceAssetId());
        vo.setConfigJson(task.getConfigJson());
        vo.setSelectedCandidate(task.getSelectedCandidate());
        vo.setUpdatedAt(task.getUpdatedAt());
        if (task.getSourceAssetId() != null) {
            try {
                vo.setSourceAssetUrl(assetService.getPublicUrlForOwnedAsset(task.getSourceAssetId(), task.getUserId()));
            } catch (BusinessException ignored) {
                // 源图已删时不阻塞列表
            }
        }
        return vo;
    }

    private String writeJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            throw new BusinessException(500, "JSON 序列化失败");
        }
    }

    private void writeDetectLog(Long userId, String scene, String prompt, String status, int costMs, String summary) {
        AiCallLog row = new AiCallLog();
        row.setUserId(userId);
        row.setScene(scene);
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
