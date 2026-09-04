package com.workbench.backendjava.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.workbench.backendjava.common.BusinessException;
import com.workbench.backendjava.dto.MattingSourceGenerateRequest;
import com.workbench.backendjava.dto.WorkflowSourceBatchPatchRequest;
import com.workbench.backendjava.dto.WorkflowSourceFromLibraryRequest;
import com.workbench.backendjava.dto.WorkflowSourcePatchRequest;
import com.workbench.backendjava.entity.CampaignDraft;
import com.workbench.backendjava.entity.OpsMattingTask;
import com.workbench.backendjava.entity.OpsWorkflowSource;
import com.workbench.backendjava.mapper.CampaignDraftMapper;
import com.workbench.backendjava.mapper.OpsMattingTaskMapper;
import com.workbench.backendjava.mapper.OpsWorkflowSourceMapper;
import com.workbench.backendjava.model.MattingConfig;
import com.workbench.backendjava.model.MattingConfig.SourceScheme;
import com.workbench.backendjava.vo.AssetVO;
import com.workbench.backendjava.vo.GenerationJobVO;
import com.workbench.backendjava.vo.ImageCandidateVO;
import com.workbench.backendjava.vo.MattingSourceSchemesVO;
import com.workbench.backendjava.vo.WorkflowSourceVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class WorkflowSourceService {

    public static final String CONTEXT_MATTING = "matting";
    public static final String CONTEXT_CAMPAIGN = "campaign";
    public static final String TYPE_UPLOAD = "upload";
    public static final String TYPE_LIBRARY = "library";
    public static final String TYPE_AI_GEN = "ai_gen";
    private static final int CAMPAIGN_MAX_SELECTED = 9;

    private final OpsWorkflowSourceMapper workflowSourceMapper;
    private final OpsMattingTaskMapper mattingTaskMapper;
    private final CampaignDraftMapper campaignDraftMapper;
    private final FileStorageService fileStorageService;
    private final AssetService assetService;
    private final GenerationJobService generationJobService;
    private final ObjectMapper objectMapper;

    @Transactional
    public List<WorkflowSourceVO> list(String context, Long taskId, Long draftId, Long userId) {
        validateContextRef(context, taskId, draftId, userId);
        maybeMigrateLegacy(context, taskId, draftId, userId);
        return listEntities(context, taskId, draftId).stream()
                .map(row -> toVO(row, userId))
                .collect(Collectors.toList());
    }

    @Transactional
    public WorkflowSourceVO upload(String context, Long taskId, Long draftId, MultipartFile file, Long userId) {
        return upload(context, taskId, draftId, file, userId, false);
    }

    @Transactional
    public WorkflowSourceVO upload(String context, Long taskId, Long draftId, MultipartFile file, Long userId,
                                   boolean ephemeralReference) {
        validateContextRef(context, taskId, draftId, userId);
        String subdir = storageSubdir(context, taskId, draftId);
        String url = fileStorageService.store(file, subdir);

        OpsWorkflowSource row = baseRow(context, taskId, draftId, userId);
        row.setSourceType(TYPE_UPLOAD);
        row.setImageUrl(url);
        row.setStoragePath(url.startsWith("/uploads/") ? url.substring("/uploads/".length()) : url);
        row.setOriginalName(file.getOriginalFilename());
        row.setSize(file.getSize());
        row.setContentType(file.getContentType());
        row.setSelected(0);
        row.setSortOrder(nextSortOrder(context, taskId, draftId));
        if (ephemeralReference) {
            row.setMetaJson(writeEphemeralMeta());
        }
        row.setCreatedAt(LocalDateTime.now());
        row.setUpdatedAt(LocalDateTime.now());
        workflowSourceMapper.insert(row);
        return toVO(row, userId);
    }

    /** 用户显式「加入素材库」：从 workflow 暂存路径入库并回写 assetId（幂等） */
    @Transactional
    public AssetVO importToAssets(Long id, Long userId, List<String> tags) {
        OpsWorkflowSource row = getOwned(id, userId);
        if (!TYPE_UPLOAD.equals(row.getSourceType()) && !TYPE_AI_GEN.equals(row.getSourceType())) {
            throw new BusinessException(400, "仅上传图或 AI 生成图可加入素材库");
        }
        if (row.getAssetId() != null) {
            return assetService.getDetail(row.getAssetId());
        }
        String storedPath = resolveStoredPath(row);
        if (storedPath == null || storedPath.isBlank()) {
            throw new BusinessException(400, "无法解析图片本地路径");
        }
        String name = row.getOriginalName() != null && !row.getOriginalName().isBlank()
                ? row.getOriginalName()
                : Optional.ofNullable(readPromptFromMeta(row.getMetaJson())).orElse("workflow-image.png");
        List<String> tagList = tags != null && !tags.isEmpty()
                ? tags
                : List.of("generated", CONTEXT_CAMPAIGN.equals(row.getContext()) ? "campaign" : "matting");
        AssetVO imported = assetService.importFromStoredPath(storedPath, name, tagList);
        row.setAssetId(imported.getId());
        row.setImageUrl(assetService.resolveWorkflowImageUrl(
                imported.getUrl(), null, imported.getId(), userId));
        row.setUpdatedAt(LocalDateTime.now());
        workflowSourceMapper.updateById(row);
        return imported;
    }

    @Transactional
    public List<WorkflowSourceVO> addFromLibrary(WorkflowSourceFromLibraryRequest request, Long userId) {
        validateContextRef(request.getContext(), request.getTaskId(), request.getDraftId(), userId);
        List<WorkflowSourceVO> result = new ArrayList<>();
        for (Long assetId : request.getAssetIds()) {
            if (assetId == null) continue;
            OpsWorkflowSource existing = findLibraryRow(request.getContext(), request.getTaskId(),
                    request.getDraftId(), assetId);
            if (existing != null) {
                result.add(toVO(existing, userId));
                continue;
            }
            String url = assetService.getPublicUrlForOwnedAsset(assetId, userId);
            OpsWorkflowSource row = baseRow(request.getContext(), request.getTaskId(), request.getDraftId(), userId);
            row.setSourceType(TYPE_LIBRARY);
            row.setImageUrl(url);
            row.setAssetId(assetId);
            row.setSelected(0);
            row.setSortOrder(nextSortOrder(request.getContext(), request.getTaskId(), request.getDraftId()));
            row.setCreatedAt(LocalDateTime.now());
            row.setUpdatedAt(LocalDateTime.now());
            workflowSourceMapper.insert(row);
            result.add(toVO(row, userId));
        }
        return result;
    }

    @Transactional
    public WorkflowSourceVO patch(Long id, WorkflowSourcePatchRequest request, Long userId) {
        OpsWorkflowSource row = getOwned(id, userId);
        if (request.getSelected() != null) {
            if (Boolean.TRUE.equals(request.getSelected())) {
                enforceMaxSelected(row, userId);
            }
            row.setSelected(Boolean.TRUE.equals(request.getSelected()) ? 1 : 0);
        }
        if (request.getSortOrder() != null) {
            row.setSortOrder(request.getSortOrder());
        }
        row.setUpdatedAt(LocalDateTime.now());
        workflowSourceMapper.updateById(row);
        return toVO(row, userId);
    }

    @Transactional
    public List<WorkflowSourceVO> batchPatch(WorkflowSourceBatchPatchRequest request, Long userId) {
        String context = null;
        Long taskId = null;
        Long draftId = null;

        if (request.getDeleteIds() != null) {
            for (Long deleteId : request.getDeleteIds()) {
                OpsWorkflowSource deleted = getOwned(deleteId, userId);
                context = deleted.getContext();
                taskId = deleted.getRefTaskId();
                draftId = deleted.getRefDraftId();
                workflowSourceMapper.deleteById(deleted.getId());
            }
        }
        if (request.getId() != null && request.getSelected() != null) {
            OpsWorkflowSource row = getOwned(request.getId(), userId);
            context = row.getContext();
            taskId = row.getRefTaskId();
            draftId = row.getRefDraftId();
            patch(request.getId(), wrapSelected(request.getSelected()), userId);
        }
        if (context == null) {
            throw new BusinessException(400, "缺少有效的 workflow source id");
        }
        return list(context, taskId, draftId, userId);
    }

    /** 兼容 Matting patch：schemeId 为 workflow source 主键字符串 */
    @Transactional
    public MattingSourceSchemesVO patchBySchemeId(String context, Long taskId, Long draftId,
                                                   String schemeId, Boolean selected, List<String> deleteIds,
                                                   Long userId) {
        if (deleteIds != null) {
            for (String idStr : deleteIds) {
                try {
                    delete(Long.parseLong(idStr), userId);
                } catch (NumberFormatException e) {
                    log.warn("忽略非法 workflow source id: {}", idStr);
                }
            }
        }
        if (schemeId != null && selected != null) {
            try {
                patch(Long.parseLong(schemeId), wrapSelected(selected), userId);
            } catch (NumberFormatException e) {
                throw new BusinessException(400, "无效的方案 id");
            }
        }
        return listAsMattingSchemes(context, taskId, draftId, userId);
    }

    @Transactional
    public void delete(Long id, Long userId) {
        OpsWorkflowSource row = getOwned(id, userId);
        if (TYPE_UPLOAD.equals(row.getSourceType()) && row.getStoragePath() != null) {
            // 磁盘文件可留作垃圾回收；软删记录即可
        }
        workflowSourceMapper.deleteById(row.getId());
    }

    @Transactional
    public MattingSourceSchemesVO generateAiMatting(Long taskId, MattingSourceGenerateRequest request, Long userId) {
        validateContextRef(CONTEXT_MATTING, taskId, null, userId);
        insertAiCandidates(CONTEXT_MATTING, taskId, null, userId, request);
        return listAsMattingSchemes(CONTEXT_MATTING, taskId, null, userId);
    }

    @Transactional
    public List<WorkflowSourceVO> generateAiCampaign(Long draftId, String prompt, List<String> referenceUrls,
                                                    int count, String aspectRatio, Long userId) {
        validateContextRef(CONTEXT_CAMPAIGN, null, draftId, userId);
        MattingSourceGenerateRequest req = new MattingSourceGenerateRequest();
        req.setPrompt(prompt);
        req.setCount(count);
        req.setAspectRatio(aspectRatio);
        req.setReferenceUrls(referenceUrls);
        insertAiCandidates(CONTEXT_CAMPAIGN, null, draftId, userId, req);
        return list(CONTEXT_CAMPAIGN, null, draftId, userId);
    }

    @Transactional
    public MattingSourceSchemesVO listAsMattingSchemes(String context, Long taskId, Long draftId, Long userId) {
        List<WorkflowSourceVO> all = list(context, taskId, draftId, userId);
        MattingSourceSchemesVO vo = new MattingSourceSchemesVO();
        vo.setSchemes(all.stream().map(this::toSchemeItem).collect(Collectors.toList()));
        return vo;
    }

    @Transactional(readOnly = true)
    public List<OpsWorkflowSource> listSelected(String context, Long taskId, Long draftId, Long userId) {
        validateContextRef(context, taskId, draftId, userId);
        return listEntities(context, taskId, draftId).stream()
                .filter(s -> s.getSelected() != null && s.getSelected() == 1)
                .sorted(Comparator.comparingInt(s -> s.getSortOrder() != null ? s.getSortOrder() : 0))
                .collect(Collectors.toList());
    }

    /** 保存活动帖：将 selected 的 upload/ai_gen 导入 asset，返回 assetId 列表（library 直接用 assetId） */
    @Transactional
    public List<Long> importSelectedToAssets(String context, Long taskId, Long draftId, Long userId,
                                                List<String> importTags) {
        List<OpsWorkflowSource> selected = listSelected(context, taskId, draftId, userId);
        List<Long> assetIds = new ArrayList<>();
        for (OpsWorkflowSource row : selected) {
            if (TYPE_LIBRARY.equals(row.getSourceType()) && row.getAssetId() != null) {
                assetIds.add(row.getAssetId());
                continue;
            }
            if (isEphemeralReference(row)) {
                continue;
            }
            if (row.getAssetId() != null) {
                assetIds.add(row.getAssetId());
                continue;
            }
            String name = row.getOriginalName() != null ? row.getOriginalName() : "workflow-image.png";
            List<String> tags = importTags != null ? importTags : List.of("generated", context);
            AssetVO imported;
            String storedPath = resolveStoredPath(row);
            if (storedPath != null) {
                imported = assetService.importFromStoredPath(storedPath, name, tags);
            } else {
                imported = assetService.importFromUrl(row.getImageUrl(), name, tags);
            }
            row.setAssetId(imported.getId());
            row.setImageUrl(assetService.resolveWorkflowImageUrl(
                    imported.getUrl(), null, imported.getId(), userId));
            row.setUpdatedAt(LocalDateTime.now());
            workflowSourceMapper.updateById(row);
            assetIds.add(imported.getId());
        }
        return assetIds;
    }

    @Transactional(readOnly = true)
    public List<WorkflowSourceVO> listSelectedVO(String context, Long taskId, Long draftId, Long userId) {
        return listSelected(context, taskId, draftId, userId).stream()
                .map(row -> toVO(row, userId))
                .collect(Collectors.toList());
    }

    private void insertAiCandidates(String context, Long taskId, Long draftId, Long userId,
                                    MattingSourceGenerateRequest request) {
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
                userId, "image_gen", taskId, draftId, prompt, sourceUrl, count, aspectRatio);

        List<ImageCandidateVO> candidates = job.getCandidates();
        if (candidates == null) return;

        // 仅写 ops_workflow_source + 磁盘，不入 asset 表；入库由「加入素材库」或保存活动帖触发
        int sort = nextSortOrder(context, taskId, draftId);
        String subdir = storageSubdir(context, taskId, draftId);
        for (ImageCandidateVO c : candidates) {
            if (c.getUrl() == null || c.getUrl().isBlank()) continue;
            String path = assetService.persistProviderImage(
                    c.getUrl(), subdir, "ai-gen-" + UUID.randomUUID());
            OpsWorkflowSource row = baseRow(context, taskId, draftId, userId);
            row.setSourceType(TYPE_AI_GEN);
            row.setImageUrl(path);
            row.setStoragePath(path.startsWith("/uploads/") ? path.substring("/uploads/".length()) : path);
            row.setSelected(0);
            row.setSortOrder(sort++);
            row.setMetaJson(writeMeta(prompt, aspectRatio, refUrls, job.getId()));
            row.setCreatedAt(LocalDateTime.now());
            row.setUpdatedAt(LocalDateTime.now());
            workflowSourceMapper.insert(row);
        }
    }

    @Transactional(readOnly = true)
    public List<OpsWorkflowSource> listByIdsForTask(Long taskId, List<Long> ids, Long userId) {
        getOwnedTaskForService(taskId, userId);
        List<OpsWorkflowSource> result = new ArrayList<>();
        for (Long id : ids) {
            OpsWorkflowSource row = getOwned(id, userId);
            if (!CONTEXT_MATTING.equals(row.getContext()) || !taskId.equals(row.getRefTaskId())) {
                throw new BusinessException(400, "源图不属于当前任务");
            }
            result.add(row);
        }
        return result;
    }

    private void getOwnedTaskForService(Long taskId, Long userId) {
        OpsMattingTask task = mattingTaskMapper.selectById(taskId);
        if (task == null || !userId.equals(task.getUserId())) {
            throw new BusinessException(404, "抠图任务不存在");
        }
    }

    private void maybeMigrateLegacy(String context, Long taskId, Long draftId, Long userId) {
        if (!listEntities(context, taskId, draftId).isEmpty()) {
            return;
        }
        if (CONTEXT_MATTING.equals(context) && taskId != null) {
            migrateMattingConfig(taskId, userId);
        } else if (CONTEXT_CAMPAIGN.equals(context) && draftId != null) {
            migrateCampaignActivity(draftId, userId);
        }
    }

    private void migrateMattingConfig(Long taskId, Long userId) {
        OpsMattingTask task = mattingTaskMapper.selectById(taskId);
        if (task == null || !userId.equals(task.getUserId()) || task.getConfigJson() == null) {
            return;
        }
        try {
            MattingConfig config = objectMapper.readValue(task.getConfigJson(), MattingConfig.class);
            if (config.getSourceSchemes() == null || config.getSourceSchemes().isEmpty()) {
                return;
            }
            int sort = 0;
            for (SourceScheme scheme : config.getSourceSchemes()) {
                OpsWorkflowSource row = baseRow(CONTEXT_MATTING, taskId, null, userId);
                row.setSourceType(TYPE_AI_GEN);
                row.setImageUrl(scheme.getImageUrl());
                row.setAssetId(scheme.getAssetId());
                row.setSelected(Boolean.TRUE.equals(scheme.getSelected()) ? 1 : 0);
                row.setSortOrder(sort++);
                row.setMetaJson(writeMeta(
                        scheme.getPrompt(),
                        scheme.getAspectRatio(),
                        scheme.getReferenceUrls(),
                        scheme.getGenerationJobId()));
                row.setCreatedAt(LocalDateTime.now());
                row.setUpdatedAt(LocalDateTime.now());
                workflowSourceMapper.insert(row);
            }
            config.setSourceSchemes(new ArrayList<>());
            task.setConfigJson(objectMapper.writeValueAsString(config));
            task.setUpdatedAt(LocalDateTime.now());
            mattingTaskMapper.updateById(task);
        } catch (JsonProcessingException e) {
            log.warn("迁移 matting sourceSchemes 失败 taskId={}", taskId, e);
        }
    }

    private void migrateCampaignActivity(Long draftId, Long userId) {
        CampaignDraft draft = campaignDraftMapper.selectById(draftId);
        if (draft == null || !userId.equals(draft.getUserId())) {
            return;
        }
        Map<String, Object> activity = readActivityMap(draft.getActivityJson());
        boolean changed = false;
        int sort = 0;

        Object schemesObj = activity.get("postSchemes");
        if (schemesObj instanceof List<?> list) {
            for (Object item : list) {
                if (!(item instanceof Map<?, ?> map)) continue;
                OpsWorkflowSource row = baseRow(CONTEXT_CAMPAIGN, null, draftId, userId);
                row.setSourceType(TYPE_AI_GEN);
                row.setImageUrl(str(map.get("imageUrl")));
                Object assetId = map.get("assetId");
                if (assetId instanceof Number n) row.setAssetId(n.longValue());
                Object sel = map.get("selected");
                row.setSelected(Boolean.TRUE.equals(sel) ? 1 : 0);
                row.setSortOrder(sort++);
                row.setMetaJson(writeMeta(
                        str(map.get("prompt")),
                        str(map.get("aspectRatio")),
                        null,
                        map.get("generationJobId") instanceof Number n ? n.longValue() : null));
                row.setCreatedAt(LocalDateTime.now());
                row.setUpdatedAt(LocalDateTime.now());
                workflowSourceMapper.insert(row);
            }
            activity.remove("postSchemes");
            changed = true;
        }

        Object assetIdsObj = activity.get("selectedAssetIds");
        if (assetIdsObj instanceof List<?> ids) {
            for (Object idObj : ids) {
                if (!(idObj instanceof Number n)) continue;
                Long assetId = n.longValue();
                try {
                    String url = assetService.getPublicUrlForOwnedAsset(assetId, userId);
                    OpsWorkflowSource row = baseRow(CONTEXT_CAMPAIGN, null, draftId, userId);
                    row.setSourceType(TYPE_LIBRARY);
                    row.setImageUrl(url);
                    row.setAssetId(assetId);
                    row.setSelected(1);
                    row.setSortOrder(sort++);
                    row.setCreatedAt(LocalDateTime.now());
                    row.setUpdatedAt(LocalDateTime.now());
                    workflowSourceMapper.insert(row);
                } catch (BusinessException ignored) {
                    /* skip missing asset */
                }
            }
            activity.remove("selectedAssetIds");
            changed = true;
        }

        if (changed) {
            try {
                draft.setActivityJson(objectMapper.writeValueAsString(activity));
                draft.setUpdatedAt(LocalDateTime.now());
                campaignDraftMapper.updateById(draft);
            } catch (JsonProcessingException e) {
                log.warn("迁移 campaign activity 失败 draftId={}", draftId, e);
            }
        }
    }

    private List<OpsWorkflowSource> listEntities(String context, Long taskId, Long draftId) {
        LambdaQueryWrapper<OpsWorkflowSource> q = new LambdaQueryWrapper<OpsWorkflowSource>()
                .eq(OpsWorkflowSource::getContext, context)
                .orderByAsc(OpsWorkflowSource::getSortOrder)
                .orderByAsc(OpsWorkflowSource::getId);
        if (CONTEXT_MATTING.equals(context)) {
            q.eq(OpsWorkflowSource::getRefTaskId, taskId);
        } else {
            q.eq(OpsWorkflowSource::getRefDraftId, draftId);
        }
        return workflowSourceMapper.selectList(q);
    }

    private OpsWorkflowSource findLibraryRow(String context, Long taskId, Long draftId, Long assetId) {
        LambdaQueryWrapper<OpsWorkflowSource> q = new LambdaQueryWrapper<OpsWorkflowSource>()
                .eq(OpsWorkflowSource::getContext, context)
                .eq(OpsWorkflowSource::getSourceType, TYPE_LIBRARY)
                .eq(OpsWorkflowSource::getAssetId, assetId)
                .last("LIMIT 1");
        if (CONTEXT_MATTING.equals(context)) {
            q.eq(OpsWorkflowSource::getRefTaskId, taskId);
        } else {
            q.eq(OpsWorkflowSource::getRefDraftId, draftId);
        }
        return workflowSourceMapper.selectOne(q);
    }

    private OpsWorkflowSource getOwned(Long id, Long userId) {
        OpsWorkflowSource row = workflowSourceMapper.selectById(id);
        if (row == null || !userId.equals(row.getUserId())) {
            throw new BusinessException(404, "工作流图源不存在");
        }
        return row;
    }

    private void validateContextRef(String context, Long taskId, Long draftId, Long userId) {
        if (CONTEXT_MATTING.equals(context)) {
            if (taskId == null) throw new BusinessException(400, "taskId 必填");
            OpsMattingTask task = mattingTaskMapper.selectById(taskId);
            if (task == null || !userId.equals(task.getUserId())) {
                throw new BusinessException(404, "抠图任务不存在");
            }
        } else if (CONTEXT_CAMPAIGN.equals(context)) {
            if (draftId == null) throw new BusinessException(400, "draftId 必填");
            CampaignDraft draft = campaignDraftMapper.selectById(draftId);
            if (draft == null || !userId.equals(draft.getUserId())) {
                throw new BusinessException(404, "活动草稿不存在");
            }
        } else {
            throw new BusinessException(400, "context 必须是 matting 或 campaign");
        }
    }

    private OpsWorkflowSource baseRow(String context, Long taskId, Long draftId, Long userId) {
        OpsWorkflowSource row = new OpsWorkflowSource();
        row.setUserId(userId);
        row.setContext(context);
        row.setRefTaskId(taskId);
        row.setRefDraftId(draftId);
        return row;
    }

    private int nextSortOrder(String context, Long taskId, Long draftId) {
        List<OpsWorkflowSource> list = listEntities(context, taskId, draftId);
        return list.isEmpty() ? 0 : list.stream()
                .mapToInt(s -> s.getSortOrder() != null ? s.getSortOrder() : 0)
                .max().orElse(0) + 1;
    }

    private void enforceMaxSelected(OpsWorkflowSource row, Long userId) {
        if (!CONTEXT_CAMPAIGN.equals(row.getContext())) {
            return;
        }
        long count = listEntities(row.getContext(), row.getRefTaskId(), row.getRefDraftId()).stream()
                .filter(s -> s.getSelected() != null && s.getSelected() == 1)
                .filter(s -> !s.getId().equals(row.getId()))
                .count();
        if (count >= CAMPAIGN_MAX_SELECTED) {
            throw new BusinessException(400, "最多选择 " + CAMPAIGN_MAX_SELECTED + " 张配图");
        }
    }

    private String storageSubdir(String context, Long taskId, Long draftId) {
        if (CONTEXT_MATTING.equals(context)) {
            return "matting/" + taskId;
        }
        return "campaign/" + draftId;
    }

    private String resolveStoredPath(OpsWorkflowSource row) {
        if (row.getStoragePath() != null && !row.getStoragePath().isBlank()) {
            return row.getStoragePath();
        }
        String imageUrl = row.getImageUrl();
        if (imageUrl != null && imageUrl.startsWith("/uploads/")) {
            return imageUrl.substring("/uploads/".length());
        }
        return null;
    }

    private WorkflowSourceVO toVO(OpsWorkflowSource row, Long userId) {
        WorkflowSourceVO vo = new WorkflowSourceVO();
        vo.setId(row.getId());
        vo.setContext(row.getContext());
        vo.setSourceType(row.getSourceType());
        vo.setImageUrl(assetService.resolveWorkflowImageUrl(
                row.getImageUrl(), row.getStoragePath(), row.getAssetId(), userId));
        vo.setAssetId(row.getAssetId());
        vo.setOriginalName(row.getOriginalName());
        vo.setSize(row.getSize());
        vo.setContentType(row.getContentType());
        vo.setSelected(row.getSelected() != null && row.getSelected() == 1);
        vo.setSortOrder(row.getSortOrder());
        readMeta(row.getMetaJson(), vo);
        return vo;
    }

    private MattingSourceSchemesVO.SchemeItem toSchemeItem(WorkflowSourceVO ws) {
        MattingSourceSchemesVO.SchemeItem item = new MattingSourceSchemesVO.SchemeItem();
        item.setId(String.valueOf(ws.getId()));
        item.setImageUrl(ws.getImageUrl());
        item.setAssetId(ws.getAssetId());
        item.setPrompt(ws.getPrompt());
        item.setAspectRatio(ws.getAspectRatio());
        item.setReferenceUrls(ws.getReferenceUrls());
        item.setSelected(ws.getSelected());
        item.setGenerationJobId(ws.getGenerationJobId());
        return item;
    }

    private WorkflowSourcePatchRequest wrapSelected(Boolean selected) {
        WorkflowSourcePatchRequest r = new WorkflowSourcePatchRequest();
        r.setSelected(selected);
        return r;
    }

    private String writeMeta(String prompt, String aspectRatio, List<String> referenceUrls, Long jobId) {
        Map<String, Object> meta = new LinkedHashMap<>();
        if (prompt != null) meta.put("prompt", prompt);
        if (aspectRatio != null) meta.put("aspectRatio", aspectRatio);
        if (referenceUrls != null) meta.put("referenceUrls", referenceUrls);
        if (jobId != null) meta.put("generationJobId", jobId);
        try {
            return objectMapper.writeValueAsString(meta);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }

    private void readMeta(String metaJson, WorkflowSourceVO vo) {
        if (metaJson == null || metaJson.isBlank()) return;
        try {
            Map<String, Object> meta = objectMapper.readValue(metaJson, new TypeReference<>() {});
            vo.setPrompt(str(meta.get("prompt")));
            vo.setAspectRatio(str(meta.get("aspectRatio")));
            if (meta.get("generationJobId") instanceof Number n) {
                vo.setGenerationJobId(n.longValue());
            }
            Object refs = meta.get("referenceUrls");
            if (refs instanceof List<?> list) {
                vo.setReferenceUrls(list.stream().map(String::valueOf).collect(Collectors.toList()));
            }
            Object ephemeral = meta.get("ephemeralReference");
            if (Boolean.TRUE.equals(ephemeral) || "true".equals(String.valueOf(ephemeral))) {
                vo.setEphemeralReference(true);
            }
        } catch (JsonProcessingException ignored) {
            /* ignore */
        }
    }

    private boolean isEphemeralReference(OpsWorkflowSource row) {
        if (row.getMetaJson() == null || row.getMetaJson().isBlank()) {
            return false;
        }
        try {
            Map<String, Object> meta = objectMapper.readValue(row.getMetaJson(), new TypeReference<>() {});
            Object ephemeral = meta.get("ephemeralReference");
            return Boolean.TRUE.equals(ephemeral) || "true".equals(String.valueOf(ephemeral));
        } catch (JsonProcessingException e) {
            return false;
        }
    }

    private String writeEphemeralMeta() {
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("ephemeralReference", true);
        try {
            return objectMapper.writeValueAsString(meta);
        } catch (JsonProcessingException e) {
            return "{\"ephemeralReference\":true}";
        }
    }

    private String readPromptFromMeta(String metaJson) {
        if (metaJson == null || metaJson.isBlank()) {
            return null;
        }
        try {
            Map<String, Object> meta = objectMapper.readValue(metaJson, new TypeReference<>() {});
            return str(meta.get("prompt"));
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    private Map<String, Object> readActivityMap(String json) {
        if (json == null || json.isBlank()) return new LinkedHashMap<>();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            return new LinkedHashMap<>();
        }
    }

    private String str(Object v) {
        return v == null ? "" : v.toString();
    }
}
