package com.workbench.backendjava.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.workbench.backendjava.client.PythonAiClient;
import com.workbench.backendjava.common.BusinessException;
import com.workbench.backendjava.common.LoginUserContext;
import com.workbench.backendjava.dto.*;
import com.workbench.backendjava.entity.AiCallLog;
import com.workbench.backendjava.entity.GenerationJob;
import com.workbench.backendjava.entity.OpsMattingTask;
import com.workbench.backendjava.entity.PromptTemplate;
import com.workbench.backendjava.mapper.AiCallLogMapper;
import com.workbench.backendjava.entity.OpsMattingTaskGroup;
import com.workbench.backendjava.mapper.GenerationJobMapper;
import com.workbench.backendjava.mapper.OpsMattingTaskGroupMapper;
import com.workbench.backendjava.mapper.OpsMattingTaskMapper;
import com.workbench.backendjava.mapper.PromptTemplateMapper;
import com.workbench.backendjava.model.MattingConfig;
import com.workbench.backendjava.model.MattingConfig.ConfirmedSource;
import com.workbench.backendjava.model.MattingConfig.CropRegion;
import com.workbench.backendjava.model.MattingConfig.ElementImage;
import com.workbench.backendjava.model.MattingConfig.ElementItem;
import com.workbench.backendjava.model.MattingConfig.SourceScheme;
import com.workbench.backendjava.vo.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/** 抠图任务 CRUD + 框选/识别/提取/保存编排 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MattingTaskService {

    private static final int MAX_REGIONS = 6;
    private static final int MAX_ELEMENT_NAME_LEN = 10;
    private static final int MAX_ELEMENTS_PER_GROUP = 20;
    private static final String LEGACY_SOURCE_ID = "legacy";

    private final OpsMattingTaskMapper mattingTaskMapper;
    private final OpsMattingTaskGroupMapper mattingTaskGroupMapper;
    private final AssetService assetService;
    private final GenerationJobService generationJobService;
    private final GenerationJobMapper generationJobMapper;
    private final MattingExtractService mattingExtractService;
    private final MattingImageCropService mattingImageCropService;
    private final PromptTemplateMapper promptTemplateMapper;
    private final PythonAiClient pythonAiClient;
    private final AiCallLogMapper aiCallLogMapper;
    private final ObjectMapper objectMapper;

    public List<MattingTaskVO> listTasks() {
        Long userId = requireUserId();
        List<OpsMattingTask> tasks = mattingTaskMapper.selectList(
                new LambdaQueryWrapper<OpsMattingTask>()
                        .eq(OpsMattingTask::getUserId, userId)
        );
        Map<Long, Integer> groupSort = mattingTaskGroupMapper.selectList(
                new LambdaQueryWrapper<OpsMattingTaskGroup>()
                        .eq(OpsMattingTaskGroup::getUserId, userId)
        ).stream().collect(Collectors.toMap(OpsMattingTaskGroup::getId, g -> g.getSortOrder() != null ? g.getSortOrder() : 0));

        tasks.sort(taskSidebarComparator(groupSort));
        return tasks.stream().map(this::toVO).collect(Collectors.toList());
    }

    public MattingSidebarVO getSidebar() {
        Long userId = requireUserId();
        MattingSidebarVO vo = new MattingSidebarVO();
        vo.setGroups(mattingTaskGroupMapper.selectList(
                new LambdaQueryWrapper<OpsMattingTaskGroup>()
                        .eq(OpsMattingTaskGroup::getUserId, userId)
                        .orderByAsc(OpsMattingTaskGroup::getSortOrder)
                        .orderByAsc(OpsMattingTaskGroup::getId)
        ).stream().map(g -> {
            MattingTaskGroupVO gv = new MattingTaskGroupVO();
            gv.setId(g.getId());
            gv.setName(g.getName());
            gv.setSortOrder(g.getSortOrder());
            gv.setUpdatedAt(g.getUpdatedAt());
            return gv;
        }).collect(Collectors.toList()));
        vo.setTasks(listTasks());
        return vo;
    }

    private Comparator<OpsMattingTask> taskSidebarComparator(Map<Long, Integer> groupSort) {
        return Comparator
                .comparing((OpsMattingTask t) -> t.getPinned() != null && t.getPinned() == 1 ? 0 : 1)
                .thenComparing(t -> {
                    if (t.getGroupId() == null) {
                        return Integer.MAX_VALUE;
                    }
                    return groupSort.getOrDefault(t.getGroupId(), Integer.MAX_VALUE - 1);
                })
                .thenComparing(t -> t.getSortOrder() != null ? t.getSortOrder() : 0)
                .thenComparing(OpsMattingTask::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder()));
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
    public void deleteTask(Long id) {
        Long userId = requireUserId();
        getOwnedTask(id, userId);
        mattingTaskMapper.deleteById(id);
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
        if (request.getGroupId() != null) {
            if (request.getGroupId() == 0) {
                task.setGroupId(null);
            } else {
                OpsMattingTaskGroup group = mattingTaskGroupMapper.selectById(request.getGroupId());
                if (group == null || !userId.equals(group.getUserId())) {
                    throw new BusinessException(404, "分组不存在");
                }
                task.setGroupId(request.getGroupId());
            }
        }
        if (request.getPinned() != null) {
            task.setPinned(Boolean.TRUE.equals(request.getPinned()) ? 1 : 0);
        }
        if (request.getSortOrder() != null) {
            task.setSortOrder(request.getSortOrder());
        }

        task.setUpdatedAt(LocalDateTime.now());
        mattingTaskMapper.updateById(task);
        return toVO(task);
    }

    /** 查询已保存的框选坐标（草稿或确认后均可恢复 UI，对齐美术机台 crop/list） */
    public MattingCropRegionsVO getCropRegions(Long taskId) {
        OpsMattingTask task = getOwnedTask(taskId, requireUserId());
        MattingConfig config = parseConfig(task.getConfigJson());
        ensureConfirmedSources(config, task);
        return buildCropRegionsVO(config);
    }

    @Transactional
    public MattingTaskVO saveCropRegions(Long taskId, MattingCropSaveRequest request) {
        Long userId = requireUserId();
        OpsMattingTask task = getOwnedTask(taskId, userId);
        MattingConfig config = parseConfig(task.getConfigJson());
        ensureConfirmedSources(config, task);
        if (config.getConfirmedSources().isEmpty()) {
            throw new BusinessException(400, "请先选择源图");
        }

        boolean draft = Boolean.TRUE.equals(request.getDraft());

        if (!draft && task.getStage() != null && task.getStage() >= 3) {
            clearConfigFrom(config, 3);
        }

        if (draft) {
            if (request.getSourceId() == null || request.getSourceId().isBlank()) {
                throw new BusinessException(400, "草稿保存需指定 sourceId");
            }
            applyDraftCropForSource(config, request.getSourceId(), request.getUseOriginal(),
                    request.getRegions(), userId);
        } else if (request.getSources() != null && !request.getSources().isEmpty()) {
            replaceAllSourceCrops(config, request.getSources(), userId);
        } else {
            throw new BusinessException(400, "请提供 sources 或 draft+sourceId");
        }

        task.setConfigJson(writeJson(config));
        if (!draft) {
            task.setStage(2);
        } else if (task.getStage() == null || task.getStage() < 2) {
            task.setStage(2);
        }
        task.setUpdatedAt(LocalDateTime.now());
        mattingTaskMapper.updateById(task);
        return toVO(task);
    }

    private void replaceAllSourceCrops(MattingConfig config,
                                       List<MattingCropSaveRequest.SourceCropItem> sources,
                                       Long userId) {
        config.setCropRegions(new ArrayList<>());
        for (MattingCropSaveRequest.SourceCropItem src : sources) {
            applySourceCrop(config, src.getSourceId(), src.getUseOriginal(), src.getRegions(), userId, true);
        }
    }

    private void applyDraftCropForSource(MattingConfig config, String sourceId, Boolean useOriginal,
                                         List<MattingCropSaveRequest.CropRegionItem> items, Long userId) {
        applySourceCrop(config, sourceId, useOriginal, items, userId, false);
    }

    private void applySourceCrop(MattingConfig config, String sourceId, Boolean useOriginal,
                                 List<MattingCropSaveRequest.CropRegionItem> items, Long userId,
                                 boolean requireRegions) {
        ConfirmedSource src = findConfirmedSource(config, sourceId);
        src.setUseOriginal(Boolean.TRUE.equals(useOriginal));

        Map<String, CropRegion> existingById = config.getCropRegions().stream()
                .filter(r -> sourceId.equals(r.getSourceId()) && r.getId() != null)
                .collect(Collectors.toMap(CropRegion::getId, r -> r, (a, b) -> a, LinkedHashMap::new));

        config.getCropRegions().removeIf(r -> sourceId.equals(r.getSourceId()));

        if (Boolean.TRUE.equals(useOriginal)) {
            CropRegion region = new CropRegion();
            region.setId("r_original_" + sourceId);
            region.setSourceId(sourceId);
            region.setUseOriginal(true);
            config.getCropRegions().add(region);
            return;
        }

        if (items == null) {
            items = List.of();
        }
        if (requireRegions && items.isEmpty()) {
            throw new BusinessException(400, src.getLabel() + "：请至少框选一个区域，或选择使用原图");
        }
        if (items.size() > MAX_REGIONS) {
            throw new BusinessException(400, src.getLabel() + "：最多 " + MAX_REGIONS + " 个切割区域");
        }
        for (MattingCropSaveRequest.CropRegionItem item : items) {
            CropRegion prev = item.getId() != null ? existingById.get(item.getId()) : null;
            CropRegion region = toCropRegion(item, userId, prev);
            region.setSourceId(sourceId);
            config.getCropRegions().add(region);
        }
    }

    private CropRegion toCropRegion(
            MattingCropSaveRequest.CropRegionItem item,
            Long userId,
            CropRegion prev) {
        CropRegion region = new CropRegion();
        region.setId(item.getId() != null ? item.getId() : "r_" + UUID.randomUUID().toString().substring(0, 8));
        region.setXPct(item.getXPct());
        region.setYPct(item.getYPct());
        region.setWPct(item.getWPct());
        region.setHPct(item.getHPct());
        region.setUseOriginal(false);

        region.setSubAssetId(null);
        if (prev != null && prev.getSubAssetUrl() != null && !prev.getSubAssetUrl().isBlank()) {
            region.setSubAssetUrl(prev.getSubAssetUrl());
        }
        return region;
    }

    private MattingCropRegionsVO buildCropRegionsVO(MattingConfig config) {
        MattingCropRegionsVO vo = new MattingCropRegionsVO();
        List<MattingCropRegionsVO.SourceCropVO> sourceItems = new ArrayList<>();
        if (config.getConfirmedSources() == null) {
            vo.setSources(sourceItems);
            return vo;
        }
        for (ConfirmedSource cs : config.getConfirmedSources()) {
            MattingCropRegionsVO.SourceCropVO sc = new MattingCropRegionsVO.SourceCropVO();
            sc.setSourceId(cs.getId());
            sc.setUseOriginal(Boolean.TRUE.equals(cs.getUseOriginal()));
            List<MattingCropRegionsVO.RegionItem> regionItems = new ArrayList<>();
            if (config.getCropRegions() != null) {
                regionItems = config.getCropRegions().stream()
                        .filter(r -> cs.getId().equals(r.getSourceId()))
                        .filter(r -> !Boolean.TRUE.equals(r.getUseOriginal()))
                        .map(r -> {
                            MattingCropRegionsVO.RegionItem item = new MattingCropRegionsVO.RegionItem();
                            item.setId(r.getId());
                            item.setXPct(r.getXPct());
                            item.setYPct(r.getYPct());
                            item.setWPct(r.getWPct());
                            item.setHPct(r.getHPct());
                            return item;
                        })
                        .collect(Collectors.toList());
            }
            sc.setRegions(regionItems);
            sourceItems.add(sc);
        }
        vo.setSources(sourceItems);
        return vo;
    }

    @Transactional
    public MattingTaskVO confirmCrop(Long taskId) {
        Long userId = requireUserId();
        OpsMattingTask task = getOwnedTask(taskId, userId);
        MattingConfig config = parseConfig(task.getConfigJson());
        ensureConfirmedSources(config, task);
        if (config.getConfirmedSources().isEmpty()) {
            throw new BusinessException(400, "请先选择源图");
        }

        validateAllSourcesHaveCrop(config);

        ensureRegionSubAssets(task.getId(), config, userId);

        clearConfigFrom(config, 3);
        config.setDetectStatus("running");
        config.setDetectError(null);
        task.setConfigJson(writeJson(config));
        task.setStatus("running");
        mattingTaskMapper.updateById(task);

        String regionPrompt = loadPromptTemplate("matting_region");
        int sort = 0;

        try {
            for (CropRegion region : config.getCropRegions()) {
                String imageUrl = resolveRegionImageUrl(region, config, userId);
                byte[] imageBytes = resolveRegionImageBytes(region, config, userId);
                long t0 = System.currentTimeMillis();
                Map<String, List<String>> groups = pythonAiClient.opsDetectElements(imageUrl, regionPrompt, imageBytes);
                writeDetectLog(userId, "matting_detect", regionPrompt, "success",
                        (int) (System.currentTimeMillis() - t0), region.getId());

                for (Map.Entry<String, List<String>> entry : groups.entrySet()) {
                    for (String name : entry.getValue()) {
                        ElementItem el = new ElementItem();
                        el.setId("e_" + UUID.randomUUID().toString().substring(0, 8));
                        el.setRegionId(region.getId());
                        el.setGroupName(entry.getKey());
                        el.setElementName(normalizeElementName(name));
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

    private void ensureRegionSubAssets(Long taskId, MattingConfig config, Long userId) {
        if (config.getCropRegions() == null) {
            return;
        }
        for (CropRegion region : config.getCropRegions()) {
            ensureRegionSubAsset(taskId, config, region, userId);
        }
    }

    private void ensureRegionSubAsset(Long taskId, MattingConfig config, CropRegion region, Long userId) {
        if (Boolean.TRUE.equals(region.getUseOriginal())) {
            return;
        }
        ConfirmedSource source = findConfirmedSource(config, region.getSourceId());
        MattingImageCropService.CropAssetResult result =
                mattingImageCropService.cropRegionFromSource(taskId, userId, source, region);
        region.setSubAssetId(null);
        region.setSubAssetUrl(result.getStoredPath());
    }

    private void validateAllSourcesHaveCrop(MattingConfig config) {
        for (ConfirmedSource cs : config.getConfirmedSources()) {
            if (Boolean.TRUE.equals(cs.getUseOriginal())) {
                boolean hasOriginal = config.getCropRegions().stream()
                        .anyMatch(r -> cs.getId().equals(r.getSourceId()) && Boolean.TRUE.equals(r.getUseOriginal()));
                if (!hasOriginal) {
                    throw new BusinessException(400, cs.getLabel() + "：请先保存框选或使用原图");
                }
                continue;
            }
            long count = config.getCropRegions().stream()
                    .filter(r -> cs.getId().equals(r.getSourceId()))
                    .filter(r -> !Boolean.TRUE.equals(r.getUseOriginal()))
                    .count();
            if (count == 0) {
                throw new BusinessException(400, cs.getLabel() + "：请至少框选一个区域，或选择使用原图");
            }
        }
    }

    @Transactional
    public MattingTaskVO reDetectRegion(Long taskId, String regionId) {
        Long userId = requireUserId();
        OpsMattingTask task = getOwnedTask(taskId, userId);
        MattingConfig config = parseConfig(task.getConfigJson());
        ensureConfirmedSources(config, task);

        CropRegion region = config.getCropRegions().stream()
                .filter(r -> regionId.equals(r.getId()))
                .findFirst()
                .orElseThrow(() -> new BusinessException(404, "区域不存在"));

        config.getElements().removeIf(e -> regionId.equals(e.getRegionId()));
        config.setDetectStatus("running");
        task.setConfigJson(writeJson(config));
        mattingTaskMapper.updateById(task);

        ensureRegionSubAsset(taskId, config, region, userId);
        task.setConfigJson(writeJson(config));
        mattingTaskMapper.updateById(task);

        String regionPrompt = loadPromptTemplate("matting_region");
        try {
            String imageUrl = resolveRegionImageUrl(region, config, userId);
            byte[] imageBytes = resolveRegionImageBytes(region, config, userId);
            Map<String, List<String>> groups = pythonAiClient.opsDetectElements(imageUrl, regionPrompt, imageBytes);
            int sort = config.getElements().stream()
                    .mapToInt(e -> e.getSortOrder() != null ? e.getSortOrder() : 0)
                    .max().orElse(-1) + 1;
            for (Map.Entry<String, List<String>> entry : groups.entrySet()) {
                for (String name : entry.getValue()) {
                    ElementItem el = new ElementItem();
                    el.setId("e_" + UUID.randomUUID().toString().substring(0, 8));
                    el.setRegionId(regionId);
                    el.setGroupName(entry.getKey());
                    el.setElementName(normalizeElementName(name));
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
        ensureConfirmedSources(config, task);
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
            if (patch.getId() == null || patch.getId().isBlank()) {
                if (patch.getRegionId() != null && patch.getGroupName() != null) {
                    createManualElement(config, patch);
                }
                continue;
            }
            if (Boolean.TRUE.equals(patch.getDeleted())) {
                config.getElements().removeIf(e -> patch.getId().equals(e.getId()));
                continue;
            }
            config.getElements().stream()
                    .filter(e -> patch.getId().equals(e.getId()))
                    .findFirst()
                    .ifPresent(el -> {
                        if (patch.getElementName() != null) {
                            el.setElementName(normalizeElementName(patch.getElementName()));
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

    private void createManualElement(MattingConfig config, MattingElementsPatchRequest.ElementPatch patch) {
        String regionId = patch.getRegionId();
        String groupName = patch.getGroupName().trim();
        if (groupName.isEmpty()) {
            throw new BusinessException(400, "分组名称不能为空");
        }
        long countInGroup = config.getElements().stream()
                .filter(e -> regionId.equals(e.getRegionId()) && groupName.equals(e.getGroupName()))
                .count();
        if (countInGroup >= MAX_ELEMENTS_PER_GROUP) {
            throw new BusinessException(400, "该分组最多 " + MAX_ELEMENTS_PER_GROUP + " 个元素");
        }
        int sort = config.getElements().stream()
                .mapToInt(e -> e.getSortOrder() != null ? e.getSortOrder() : 0)
                .max().orElse(-1) + 1;
        String name = patch.getElementName() != null && !patch.getElementName().isBlank()
                ? patch.getElementName()
                : "新元素";
        ElementItem el = new ElementItem();
        el.setId("e_" + UUID.randomUUID().toString().substring(0, 8));
        el.setRegionId(regionId);
        el.setGroupName(groupName);
        el.setElementName(normalizeElementName(name));
        el.setChecked(true);
        el.setSortOrder(sort);
        el.setCreateType("manual");
        config.getElements().add(el);
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
        clearConfigFrom(config, 4);
        config.setExtractStatus("running");
        config.setExtractError(null);
        task.setConfigJson(writeJson(config));
        task.setStage(4);
        task.setStatus("running");
        task.setUpdatedAt(LocalDateTime.now());
        mattingTaskMapper.updateById(task);

        String sourceUrl = resolvePrimarySourceUrl(config, userId);
        MattingConfig extractConfig = config;
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                mattingExtractService.runExtractAsync(taskId, userId, extractConfig, count, sourceUrl);
            }
        });
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

        if (Boolean.TRUE.equals(request.getSaveSourceToAssets())) {
            MattingConfig config = parseConfig(task.getConfigJson());
            ensureConfirmedSources(config, task);
            List<String> tags = request.getSourceTags();
            if (tags == null || tags.isEmpty()) {
                tags = List.of("generated", "reference");
            }
            boolean configChanged = false;
            if (config.getConfirmedSources() != null && !config.getConfirmedSources().isEmpty()) {
                int idx = 0;
                for (ConfirmedSource cs : config.getConfirmedSources()) {
                    if (cs.getSourceAssetId() != null) {
                        assetService.replaceTagsByNames(cs.getSourceAssetId(), tags);
                    } else if (cs.getSourceImageUrl() != null && !cs.getSourceImageUrl().isBlank()) {
                        String name = task.getTitle() + "-source-" + (idx + 1) + ".png";
                        try {
                            AssetVO asset = assetService.importFromUrl(cs.getSourceImageUrl(), name, tags);
                            cs.setSourceAssetId(asset.getId());
                            configChanged = true;
                        } catch (BusinessException e) {
                            log.warn("保存源图入库失败: sourceId={}, reason={}", cs.getId(), e.getMessage());
                        }
                    }
                    idx++;
                }
            } else if (task.getSourceAssetId() != null) {
                assetService.replaceTagsByNames(task.getSourceAssetId(), tags);
            }
            if (configChanged) {
                task.setConfigJson(writeJson(config));
                task.setUpdatedAt(LocalDateTime.now());
                mattingTaskMapper.updateById(task);
            }
        }
        return saved;
    }

    @Transactional
    public MattingSourceSchemesVO getSourceSchemes(Long taskId) {
        Long userId = requireUserId();
        OpsMattingTask task = getOwnedTask(taskId, userId);
        MattingConfig config = parseConfig(task.getConfigJson());
        if (repairSourceSchemeUrls(config, userId)) {
            task.setConfigJson(writeJson(config));
            task.setUpdatedAt(LocalDateTime.now());
            mattingTaskMapper.updateById(task);
        }
        return buildSourceSchemesVO(config, userId);
    }

    @Transactional
    public MattingSourceSchemesVO generateSourceSchemes(Long taskId, MattingSourceGenerateRequest request) {
        Long userId = requireUserId();
        OpsMattingTask task = getOwnedTask(taskId, userId);
        String prompt = request.getPrompt().trim();
        int count = request.getCount() != null ? request.getCount() : 4;
        if (count < 1 || count > 6) {
            throw new BusinessException(400, "生成张数须在 1–6 之间");
        }
        String aspectRatio = request.getAspectRatio() != null && !request.getAspectRatio().isBlank()
                ? request.getAspectRatio().trim() : "9:16";
        List<String> refUrls = request.getReferenceUrls() != null ? request.getReferenceUrls() : List.of();
        String sourceUrl = refUrls.isEmpty() ? null : refUrls.get(0);

        GenerationJobVO job = generationJobService.runJob(
                userId, "image_gen", taskId, null, prompt, sourceUrl, count, aspectRatio);

        MattingConfig config = parseConfig(task.getConfigJson());
        if (config.getSourceSchemes() == null) {
            config.setSourceSchemes(new ArrayList<>());
        }
        List<ImageCandidateVO> candidates = job.getCandidates();
        if (candidates != null) {
            for (ImageCandidateVO c : candidates) {
                if (c.getUrl() == null || c.getUrl().isBlank()) continue;
                SourceScheme scheme = new SourceScheme();
                scheme.setId("s_" + UUID.randomUUID().toString().substring(0, 8));
                scheme.setImageUrl(c.getUrl());
                scheme.setPrompt(prompt);
                scheme.setAspectRatio(aspectRatio);
                scheme.setReferenceUrls(new ArrayList<>(refUrls));
                scheme.setSelected(false);
                scheme.setGenerationJobId(job.getId());
                config.getSourceSchemes().add(scheme);
            }
        }
        task.setConfigJson(writeJson(config));
        task.setUpdatedAt(LocalDateTime.now());
        mattingTaskMapper.updateById(task);
        return buildSourceSchemesVO(config, userId);
    }

    @Transactional
    public MattingSourceSchemesVO patchSourceSchemes(Long taskId, MattingSourceSchemesPatchRequest request) {
        OpsMattingTask task = getOwnedTask(taskId, requireUserId());
        MattingConfig config = parseConfig(task.getConfigJson());
        if (config.getSourceSchemes() == null) {
            config.setSourceSchemes(new ArrayList<>());
        }

        if (request.getDeleteIds() != null && !request.getDeleteIds().isEmpty()) {
            for (String deleteId : request.getDeleteIds()) {
                removeSourceData(config, deleteId);
            }
            config.getSourceSchemes().removeIf(s -> request.getDeleteIds().contains(s.getId()));
        }

        if (request.getSchemeId() != null) {
            String schemeId = request.getSchemeId();
            boolean selected = Boolean.TRUE.equals(request.getSelected());
            for (SourceScheme s : config.getSourceSchemes()) {
                if (schemeId.equals(s.getId())) {
                    s.setSelected(selected);
                }
            }
        }

        task.setConfigJson(writeJson(config));
        task.setUpdatedAt(LocalDateTime.now());
        mattingTaskMapper.updateById(task);
        return buildSourceSchemesVO(config, requireUserId());
    }

    @Transactional
    public MattingTaskVO confirmSource(Long taskId, MattingSourceConfirmRequest request) {
        Long userId = requireUserId();
        OpsMattingTask task = getOwnedTask(taskId, userId);
        MattingConfig config = parseConfig(task.getConfigJson());

        List<String> schemeIds = new ArrayList<>();
        if (request.getSchemeIds() != null) {
            schemeIds.addAll(request.getSchemeIds());
        }
        if (request.getSchemeId() != null && !request.getSchemeId().isBlank()) {
            schemeIds.add(request.getSchemeId());
        }

        List<Long> sourceAssetIds = new ArrayList<>();
        if (request.getSourceAssetIds() != null) {
            sourceAssetIds.addAll(request.getSourceAssetIds());
        }
        if (request.getSourceAssetId() != null) {
            sourceAssetIds.add(request.getSourceAssetId());
        }

        if (schemeIds.isEmpty() && sourceAssetIds.isEmpty()) {
            throw new BusinessException(400, "请至少选择一张源图");
        }

        List<ConfirmedSource> newSources = new ArrayList<>();
        int sort = 0;
        Set<String> schemeIdSet = new LinkedHashSet<>(schemeIds);

        for (String schemeId : schemeIdSet) {
            SourceScheme scheme = config.getSourceSchemes().stream()
                    .filter(s -> schemeId.equals(s.getId()))
                    .findFirst()
                    .orElseThrow(() -> new BusinessException(404, "方案不存在: " + schemeId));
            String displayUrl = resolveSchemeDisplayUrl(scheme, userId);
            if (displayUrl == null || displayUrl.isBlank()) {
                throw new BusinessException(400, "方案图片无效");
            }
            ConfirmedSource cs = new ConfirmedSource();
            cs.setId(schemeId);
            cs.setSchemeId(schemeId);
            cs.setSourceImageUrl(displayUrl);
            cs.setLabel("方案 " + (sort + 1));
            cs.setSortOrder(sort++);
            cs.setUseOriginal(false);
            newSources.add(cs);
        }

        Set<Long> assetIdSet = new LinkedHashSet<>(sourceAssetIds);
        for (Long assetId : assetIdSet) {
            assetService.getPublicUrlForOwnedAsset(assetId, userId);
            ConfirmedSource cs = new ConfirmedSource();
            cs.setId("a_" + assetId);
            cs.setSourceAssetId(assetId);
            cs.setLabel("素材 " + (sort + 1));
            cs.setSortOrder(sort++);
            cs.setUseOriginal(false);
            newSources.add(cs);
        }

        if (config.getSourceSchemes() != null) {
            for (SourceScheme s : config.getSourceSchemes()) {
                s.setSelected(schemeIdSet.contains(s.getId()));
            }
        }

        boolean sourceChanged = !sourcesEqual(config.getConfirmedSources(), newSources);
        config.setConfirmedSources(newSources);
        if (sourceChanged) {
            clearConfigFrom(config, 2);
            task.setSelectedCandidate(null);
            task.setStatus("draft");
        }

        task.setSourceAssetId(newSources.stream()
                .map(ConfirmedSource::getSourceAssetId)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(null));
        task.setConfigJson(writeJson(config));
        task.setStage(2);
        task.setUpdatedAt(LocalDateTime.now());
        mattingTaskMapper.updateById(task);
        return toVO(task);
    }

    private boolean sourcesEqual(List<ConfirmedSource> a, List<ConfirmedSource> b) {
        if (a == null || a.isEmpty()) {
            return b == null || b.isEmpty();
        }
        if (b == null || a.size() != b.size()) {
            return false;
        }
        for (int i = 0; i < a.size(); i++) {
            ConfirmedSource x = a.get(i);
            ConfirmedSource y = b.get(i);
            if (!Objects.equals(x.getId(), y.getId())
                    || !Objects.equals(x.getSourceAssetId(), y.getSourceAssetId())) {
                return false;
            }
        }
        return true;
    }

    private void removeSourceData(MattingConfig config, String sourceId) {
        Set<String> regionIds = config.getCropRegions().stream()
                .filter(r -> sourceId.equals(r.getSourceId()))
                .map(CropRegion::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        config.getCropRegions().removeIf(r -> sourceId.equals(r.getSourceId()));
        config.getElements().removeIf(e -> regionIds.contains(e.getRegionId()));
        if (config.getConfirmedSources() != null) {
            config.getConfirmedSources().removeIf(cs ->
                    sourceId.equals(cs.getId()) || sourceId.equals(cs.getSchemeId()));
        }
    }

    private MattingSourceSchemesVO buildSourceSchemesVO(MattingConfig config, Long userId) {
        MattingSourceSchemesVO vo = new MattingSourceSchemesVO();
        List<SourceScheme> stored = config.getSourceSchemes();
        if (stored == null || stored.isEmpty()) {
            vo.setSchemes(new ArrayList<>());
            return vo;
        }
        vo.setSchemes(stored.stream().map(s -> {
            MattingSourceSchemesVO.SchemeItem item = new MattingSourceSchemesVO.SchemeItem();
            item.setId(s.getId());
            item.setAssetId(s.getAssetId());
            item.setPrompt(s.getPrompt());
            item.setAspectRatio(s.getAspectRatio());
            item.setReferenceUrls(s.getReferenceUrls());
            item.setSelected(s.getSelected());
            item.setGenerationJobId(s.getGenerationJobId());
            item.setImageUrl(resolveSchemeDisplayUrl(s, userId));
            return item;
        }).collect(Collectors.toList()));
        return vo;
    }

    /** 展示/确认用 URL：优先外链或 generation_job 候选，旧任务可回退 assetId */
    private String resolveSchemeDisplayUrl(SourceScheme scheme, Long userId) {
        String fromJob = resolveRemoteUrlForScheme(scheme, userId);
        if (fromJob != null && !fromJob.isBlank()) {
            return fromJob;
        }
        if (scheme.getAssetId() != null && userId != null) {
            try {
                return assetService.getPublicUrlForOwnedAsset(scheme.getAssetId(), userId);
            } catch (BusinessException ignored) {
                /* fall through */
            }
        }
        return scheme.getImageUrl();
    }

    private boolean repairSourceSchemeUrls(MattingConfig config, Long userId) {
        if (config.getSourceSchemes() == null || config.getSourceSchemes().isEmpty()) {
            return false;
        }
        boolean changed = false;
        for (SourceScheme scheme : config.getSourceSchemes()) {
            String resolved = resolveSchemeDisplayUrl(scheme, userId);
            if (resolved != null && !resolved.isBlank() && !Objects.equals(resolved, scheme.getImageUrl())) {
                scheme.setImageUrl(resolved);
                changed = true;
            }
        }
        return changed;
    }

    private String resolveRemoteUrlForScheme(SourceScheme scheme, Long userId) {
        if (scheme.getImageUrl() != null && !scheme.getImageUrl().isBlank()
                && isExternalProviderUrl(scheme.getImageUrl())) {
            return scheme.getImageUrl();
        }
        if (scheme.getGenerationJobId() == null) {
            return scheme.getImageUrl();
        }
        GenerationJob job = generationJobMapper.selectById(scheme.getGenerationJobId());
        if (job == null || !userId.equals(job.getUserId())) {
            return scheme.getImageUrl();
        }
        List<ImageCandidateVO> candidates = parseJobCandidates(job.getCandidatesJson());
        if (candidates.isEmpty()) {
            return scheme.getImageUrl();
        }
        if (scheme.getImageUrl() != null && !scheme.getImageUrl().isBlank()) {
            for (ImageCandidateVO c : candidates) {
                if (scheme.getImageUrl().equals(c.getUrl())) {
                    return c.getUrl();
                }
            }
        }
        return candidates.get(0).getUrl();
    }

    private boolean isExternalProviderUrl(String url) {
        if (url == null || url.isBlank()) {
            return false;
        }
        String lower = url.toLowerCase();
        if (lower.contains("localhost") || lower.contains("127.0.0.1")) {
            return false;
        }
        return lower.startsWith("http://") || lower.startsWith("https://");
    }

    @SuppressWarnings("unchecked")
    private List<ImageCandidateVO> parseJobCandidates(String json) {
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

        List<MattingElementsVO.SourceElementsVO> sourceItems = new ArrayList<>();
        List<MattingElementsVO.RegionElementsVO> flatRegions = new ArrayList<>();

        if (config.getConfirmedSources() != null) {
            for (ConfirmedSource cs : config.getConfirmedSources()) {
                MattingElementsVO.SourceElementsVO sv = new MattingElementsVO.SourceElementsVO();
                sv.setSourceId(cs.getId());
                sv.setLabel(cs.getLabel());
                sv.setSourceDescription(resolveSourceDescription(cs, config, userId));
                String sourceThumb = resolveConfirmedSourceUrl(cs, userId);
                if (sourceThumb != null) {
                    sv.setImageUrl(sourceThumb);
                }

                List<MattingElementsVO.RegionElementsVO> regions = buildRegionElementsForSource(config, cs.getId(), userId);
                sv.setRegions(regions);
                sourceItems.add(sv);
                flatRegions.addAll(regions);
            }
        }

        vo.setSources(sourceItems);
        vo.setRegions(flatRegions);
        return vo;
    }

    private List<MattingElementsVO.RegionElementsVO> buildRegionElementsForSource(
            MattingConfig config, String sourceId, Long userId) {
        List<MattingElementsVO.RegionElementsVO> regions = new ArrayList<>();
        int regionIndex = 0;
        if (config.getCropRegions() == null) {
            return regions;
        }
        for (CropRegion region : config.getCropRegions()) {
            if (!sourceId.equals(region.getSourceId())) {
                continue;
            }
            MattingElementsVO.RegionElementsVO rv = new MattingElementsVO.RegionElementsVO();
            rv.setRegionId(region.getId());
            if (Boolean.TRUE.equals(region.getUseOriginal())) {
                rv.setRegionLabel("区域 1（全图）");
                try {
                    rv.setImageUrl(resolveSourceUrl(config, sourceId, userId));
                } catch (BusinessException ignored) {
                    rv.setImageUrl(null);
                }
            } else {
                rv.setRegionLabel("区域 " + (++regionIndex));
                try {
                    String sourceUrl = resolveSourceUrl(config, sourceId, userId);
                    rv.setImageUrl(resolveCropRegionPublicUrl(region, userId, sourceUrl));
                } catch (BusinessException ignored) {
                    rv.setImageUrl(null);
                }
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
                    row.setElementName(normalizeElementName(e.getElementName()));
                    row.setChecked(e.getChecked());
                    row.setCreateType(e.getCreateType());
                    return row;
                }).collect(Collectors.toList()));
                groups.add(gv);
            }
            rv.setGroups(groups);
            regions.add(rv);
        }
        return regions;
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

    private String resolveRegionImageUrl(CropRegion region, MattingConfig config, Long userId) {
        String sourceUrl = resolveSourceUrl(config, region.getSourceId(), userId);
        if (Boolean.TRUE.equals(region.getUseOriginal())) {
            return sourceUrl;
        }
        return resolveCropRegionPublicUrl(region, userId, sourceUrl);
    }

    private String resolveCropRegionPublicUrl(CropRegion region, Long userId, String fallbackSourceUrl) {
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
        return fallbackSourceUrl;
    }

    /** 供视觉识别 L2 inline base64：优先 subAsset，useOriginal 读整图源图 */
    private byte[] resolveRegionImageBytes(CropRegion region, MattingConfig config, Long userId) {
        if (Boolean.TRUE.equals(region.getUseOriginal())) {
            ConfirmedSource source = findConfirmedSource(config, region.getSourceId());
            return mattingImageCropService.readSourceBytes(userId, source);
        }
        return resolveCropRegionImageBytes(region, userId);
    }

    private byte[] resolveCropRegionImageBytes(CropRegion region, Long userId) {
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

    private String resolvePrimarySourceUrl(MattingConfig config, Long userId) {
        if (config.getConfirmedSources() != null && !config.getConfirmedSources().isEmpty()) {
            for (ConfirmedSource cs : config.getConfirmedSources()) {
                String url = resolveConfirmedSourceUrl(cs, userId);
                if (url != null && !url.isBlank()) {
                    return url;
                }
            }
        }
        throw new BusinessException(400, "源图不可用");
    }

    private String resolveSourceUrl(MattingConfig config, String sourceId, Long userId) {
        if (config.getConfirmedSources() != null && sourceId != null) {
            for (ConfirmedSource cs : config.getConfirmedSources()) {
                if (sourceId.equals(cs.getId())) {
                    String url = resolveConfirmedSourceUrl(cs, userId);
                    if (url != null) {
                        return url;
                    }
                }
            }
        }
        if (config.getConfirmedSources() != null && !config.getConfirmedSources().isEmpty()) {
            String url = resolveConfirmedSourceUrl(config.getConfirmedSources().get(0), userId);
            if (url != null) {
                return url;
            }
        }
        throw new BusinessException(400, "源图不可用");
    }

    private String resolveConfirmedSourceUrl(ConfirmedSource cs, Long userId) {
        if (cs.getSourceAssetId() != null) {
            try {
                return assetService.getPublicUrlForOwnedAsset(cs.getSourceAssetId(), userId);
            } catch (BusinessException ignored) {
                /* fall through to external url */
            }
        }
        if (cs.getSourceImageUrl() != null && !cs.getSourceImageUrl().isBlank()) {
            return cs.getSourceImageUrl();
        }
        return null;
    }

    private ConfirmedSource findConfirmedSource(MattingConfig config, String sourceId) {
        if (config.getConfirmedSources() == null) {
            throw new BusinessException(404, "来源不存在");
        }
        return config.getConfirmedSources().stream()
                .filter(cs -> sourceId.equals(cs.getId()))
                .findFirst()
                .orElseThrow(() -> new BusinessException(404, "来源不存在: " + sourceId));
    }

    /** 旧单源任务兼容：合成 confirmedSources 并将 orphan cropRegions 归到 legacy id */
    private void ensureConfirmedSources(MattingConfig config, OpsMattingTask task) {
        if (config.getConfirmedSources() == null) {
            config.setConfirmedSources(new ArrayList<>());
        }
        if (!config.getConfirmedSources().isEmpty()) {
            assignOrphanCropRegions(config);
            return;
        }
        if (task.getSourceAssetId() != null) {
            ConfirmedSource cs = new ConfirmedSource();
            cs.setId(LEGACY_SOURCE_ID);
            cs.setSourceAssetId(task.getSourceAssetId());
            cs.setLabel("源图");
            cs.setSortOrder(0);
            cs.setUseOriginal(false);
            config.getConfirmedSources().add(cs);
            assignOrphanCropRegions(config);
        }
    }

    private void assignOrphanCropRegions(MattingConfig config) {
        if (config.getCropRegions() == null || config.getConfirmedSources().isEmpty()) {
            return;
        }
        String defaultSourceId = config.getConfirmedSources().get(0).getId();
        for (CropRegion r : config.getCropRegions()) {
            if (r.getSourceId() == null || r.getSourceId().isBlank()) {
                r.setSourceId(defaultSourceId);
            }
        }
        // 旧版全局 useOriginal：若存在 r_original 无 sourceId，归到第一来源
        for (CropRegion r : config.getCropRegions()) {
            if (Boolean.TRUE.equals(r.getUseOriginal()) || "r_original".equals(r.getId())) {
                if (r.getSourceId() == null) {
                    r.setSourceId(defaultSourceId);
                }
                ConfirmedSource cs = findConfirmedSource(config, r.getSourceId());
                cs.setUseOriginal(true);
            }
        }
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

    private int normalizeStage(Integer stage, MattingConfig config) {
        int normalized = stage != null ? stage : 1;
        String extractStatus = config.getExtractStatus();
        boolean hasExtract = config.getElementImages() != null && !config.getElementImages().isEmpty();
        if (hasExtract || (extractStatus != null && !"idle".equals(extractStatus))) {
            normalized = Math.max(normalized, 4);
        }
        return normalized;
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
        MattingConfig config = parseConfig(task.getConfigJson());
        vo.setStage(normalizeStage(task.getStage(), config));
        vo.setStatus(task.getStatus());
        vo.setGroupId(task.getGroupId());
        vo.setPinned(task.getPinned() != null && task.getPinned() == 1);
        vo.setSortOrder(task.getSortOrder());
        vo.setSourceAssetId(task.getSourceAssetId());
        vo.setConfigJson(task.getConfigJson());
        vo.setSelectedCandidate(task.getSelectedCandidate());
        vo.setUpdatedAt(task.getUpdatedAt());

        ensureConfirmedSources(config, task);

        List<MattingConfirmedSourceVO> confirmed = new ArrayList<>();
        if (config.getConfirmedSources() != null) {
            for (ConfirmedSource cs : config.getConfirmedSources()) {
                MattingConfirmedSourceVO csv = new MattingConfirmedSourceVO();
                csv.setId(cs.getId());
                csv.setSchemeId(cs.getSchemeId());
                csv.setSourceAssetId(cs.getSourceAssetId());
                csv.setLabel(cs.getLabel());
                csv.setSortOrder(cs.getSortOrder());
                String publicUrl = resolveConfirmedSourceUrl(cs, task.getUserId());
                if (publicUrl != null) {
                    csv.setSourceAssetUrl(publicUrl);
                }
                confirmed.add(csv);
            }
        }
        vo.setConfirmedSources(confirmed);

        if (task.getSourceAssetId() != null) {
            try {
                vo.setSourceAssetUrl(assetService.getPublicUrlForOwnedAsset(task.getSourceAssetId(), task.getUserId()));
            } catch (BusinessException ignored) {
                // 源图已删时不阻塞列表
            }
        } else if (!confirmed.isEmpty() && confirmed.get(0).getSourceAssetUrl() != null) {
            vo.setSourceAssetUrl(confirmed.get(0).getSourceAssetUrl());
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

    /** 从指定阶段起清空 config 后续数据（含该阶段之后的内容） */
    private void clearConfigFrom(MattingConfig config, int fromStage) {
        if (fromStage <= 2) {
            config.setCropRegions(new ArrayList<>());
            if (config.getConfirmedSources() != null) {
                for (ConfirmedSource cs : config.getConfirmedSources()) {
                    cs.setUseOriginal(false);
                }
            }
        }
        if (fromStage <= 3) {
            config.setElements(new ArrayList<>());
            config.setDetectStatus("idle");
            config.setDetectError(null);
        }
        if (fromStage <= 4) {
            config.setElementImages(new ArrayList<>());
            config.setExtractStatus("idle");
            config.setExtractError(null);
        }
        if (fromStage <= 5) {
            // selectedCandidate 存在 task 表字段，由调用方清 task.setSelectedCandidate
        }
    }

    private String resolveSourceDescription(ConfirmedSource cs, MattingConfig config, Long userId) {
        String schemeId = cs.getSchemeId() != null ? cs.getSchemeId() : cs.getId();
        if (schemeId != null && config.getSourceSchemes() != null) {
            for (SourceScheme scheme : config.getSourceSchemes()) {
                if (schemeId.equals(scheme.getId())) {
                    String prompt = scheme.getPrompt();
                    if (prompt != null && !prompt.isBlank()) {
                        return prompt.replaceAll("\\s+", " ").trim();
                    }
                    break;
                }
            }
        }
        if (cs.getSourceAssetId() != null) {
            try {
                return assetService.getOwnedAssetName(cs.getSourceAssetId(), userId);
            } catch (BusinessException ignored) {
                // fall through
            }
        }
        if (cs.getLabel() != null && !cs.getLabel().isBlank()) {
            return cs.getLabel();
        }
        return "未命名来源";
    }

    private String normalizeElementName(String raw) {
        if (raw == null) {
            return null;
        }
        String text = raw.trim();
        if (text.isEmpty()) {
            return text;
        }
        if (text.startsWith("{")) {
            try {
                JsonNode node = objectMapper.readTree(text);
                if (node.isObject()) {
                    for (String key : List.of("名称", "name", "elementName", "element_name")) {
                        JsonNode val = node.get(key);
                        if (val != null && val.isTextual() && !val.asText().isBlank()) {
                            return truncateElementName(val.asText().trim());
                        }
                    }
                }
            } catch (JsonProcessingException ignored) {
                // use raw text
            }
        }
        return truncateElementName(text);
    }

    private String truncateElementName(String name) {
        if (name.length() <= MAX_ELEMENT_NAME_LEN) {
            return name;
        }
        return name.substring(0, MAX_ELEMENT_NAME_LEN);
    }
}
