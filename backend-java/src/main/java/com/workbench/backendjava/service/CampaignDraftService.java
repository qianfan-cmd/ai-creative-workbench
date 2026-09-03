package com.workbench.backendjava.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.workbench.backendjava.client.PythonAiClient;
import com.workbench.backendjava.common.BusinessException;
import com.workbench.backendjava.common.LoginUserContext;
import com.workbench.backendjava.dto.CampaignCopySaveRequest;
import com.workbench.backendjava.dto.CampaignDraftCreateRequest;
import com.workbench.backendjava.dto.CampaignDraftMetaRequest;
import com.workbench.backendjava.dto.CampaignDraftPatchRequest;
import com.workbench.backendjava.dto.CampaignGenerateCopyRequest;
import com.workbench.backendjava.dto.CampaignGenerateImagesRequest;
import com.workbench.backendjava.dto.CampaignImagesSaveRequest;
import com.workbench.backendjava.entity.Asset;
import com.workbench.backendjava.entity.CampaignDraft;
import com.workbench.backendjava.entity.PromptTemplate;
import com.workbench.backendjava.mapper.AssetMapper;
import com.workbench.backendjava.mapper.CampaignDraftMapper;
import com.workbench.backendjava.mapper.PromptTemplateMapper;
import com.workbench.backendjava.config.UploadProperties;
import com.workbench.backendjava.vo.CampaignDraftListItemVO;
import com.workbench.backendjava.vo.CampaignDraftVO;
import com.workbench.backendjava.vo.GenerationJobVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.stream.Collectors;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
@RequiredArgsConstructor
@Slf4j
public class CampaignDraftService {

    private final CampaignDraftMapper campaignDraftMapper;
    private final ObjectMapper objectMapper;
    private final PromptTemplateMapper promptTemplateMapper;
    private final PythonAiClient pythonAiClient;
    private final GenerationJobService generationJobService;
    private final AssetService assetService;
    private final AssetMapper assetMapper;
    private final UploadProperties uploadProperties;
    private final WorkflowSourceService workflowSourceService;

    public List<CampaignDraftListItemVO> listDrafts() {
        Long userId = requireUserId();
        List<CampaignDraft> drafts = campaignDraftMapper.selectList(
                new LambdaQueryWrapper<CampaignDraft>()
                        .eq(CampaignDraft::getUserId, userId)
                        .orderByDesc(CampaignDraft::getPinned)
                        .orderByDesc(CampaignDraft::getUpdatedAt)
        );
        return drafts.stream().map(this::toListItem).collect(Collectors.toList());
    }

    private CampaignDraftListItemVO toListItem(CampaignDraft entity) {
        CampaignDraftListItemVO vo = new CampaignDraftListItemVO();
        vo.setId(entity.getId());
        vo.setTitle(entity.getTitle());
        vo.setPinned(entity.getPinned() != null && entity.getPinned() == 1);
        vo.setStatus(entity.getStatus());
        vo.setUpdatedAt(entity.getUpdatedAt());
        if (entity.getCoverAssetId() != null && entity.getUserId() != null) {
            try {
                vo.setCoverUrl(assetService.getPublicUrlForOwnedAsset(entity.getCoverAssetId(), entity.getUserId()));
            } catch (BusinessException ignored) {
                // cover 已删时不阻塞列表
            }
        }
        return vo;
    }

    @Transactional
    public void deleteDraft(Long id) {
        Long userId = requireUserId();
        CampaignDraft draft = getOwnedDraft(id, userId);
        campaignDraftMapper.deleteById(draft.getId());
    }

    @Transactional
    public CampaignDraftVO patchDraft(Long id, CampaignDraftPatchRequest request) {
        Long userId = requireUserId();
        CampaignDraft draft = getOwnedDraft(id, userId);
        if (request.getTitle() == null && request.getPinned() == null) {
            throw new BusinessException(400, "请提供 title 或 pinned");
        }
        if (request.getTitle() != null) {
            String title = request.getTitle().trim();
            if (title.isEmpty()) {
                throw new BusinessException(400, "标题不能为空");
            }
            draft.setTitle(title);
        }
        if (request.getPinned() != null) {
            draft.setPinned(Boolean.TRUE.equals(request.getPinned()) ? 1 : 0);
        }
        draft.setUpdatedAt(LocalDateTime.now());
        campaignDraftMapper.updateById(draft);
        return toVO(draft);
    }

    @Transactional
    public CampaignDraftVO saveActivityMeta(Long id, CampaignDraftMetaRequest request) {
        Long userId = requireUserId();
        CampaignDraft draft = getOwnedDraft(id, userId);
        // 配图选中状态已迁移至 ops_workflow_source；meta 接口保留兼容 no-op
        if (request.getPostSchemes() != null || request.getSelectedAssetIds() != null) {
            draft.setUpdatedAt(LocalDateTime.now());
            campaignDraftMapper.updateById(draft);
        }
        return toVO(draft);
    }

    @Transactional
    public CampaignDraftVO createDraft(CampaignDraftCreateRequest request) {
        Long userId = requireUserId();

        // 表单字段 → Map → JSON 字符串入库
        Map<String, Object> activity = buildActivityMap(request);
        String activityJson = writeActivityJson(activity);

        CampaignDraft draft = new CampaignDraft();
        draft.setUserId(userId);
        draft.setTitle(resolveDraftTitle(request.getTheme()));
        draft.setActivityJson(activityJson);
        draft.setStatus("draft");
        draft.setCreatedAt(LocalDateTime.now());
        draft.setUpdatedAt(LocalDateTime.now());
        campaignDraftMapper.insert(draft);

        return toVO(draft, activity);
    }

    private Map<String, Object> buildActivityMap(CampaignDraftCreateRequest req) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("theme", nullToEmpty(req.getTheme()));
        map.put("timeRange", nullToEmpty(req.getTimeRange()));
        map.put("audience", nullToEmpty(req.getAudience()));
        map.put("benefits", nullToEmpty(req.getBenefits()));
        map.put("visualStyle", nullToEmpty(req.getVisualStyle()));
        map.put("aspectRatio", nullToEmpty(req.getAspectRatio()));
        map.put("forbiddenWords", nullToEmpty(req.getForbiddenWords()));
        return map;
    }

    private String nullToEmpty(String s) {
        return s == null ? "" : s.trim();
    }

    private String writeActivityJson(Map<String, Object> activity) {
        try {
            return objectMapper.writeValueAsString(activity); // 转成json
        } catch (JsonProcessingException e) {
            throw new BusinessException(500, "活动表单序列化失败");
        }
    }

    private CampaignDraftVO toVO(CampaignDraft entity, Map<String, Object> activity) {
        CampaignDraftVO vo = new CampaignDraftVO();
        vo.setId(entity.getId());
        vo.setTitle(entity.getTitle());
        vo.setActivity(activity);
        vo.setCopyTitle(entity.getCopyTitle());
        vo.setCopyBody(entity.getCopyBody());
        vo.setStatus(entity.getStatus());
        vo.setUpdatedAt(entity.getUpdatedAt());
        vo.setCoverAssetId(entity.getCoverAssetId());
        vo.setImageAssetIds(readImageAssetIds(entity.getImageAssetIds()));
        if (entity.getCoverAssetId() != null && entity.getUserId() != null) {
            try {
                vo.setCoverUrl(assetService.getPublicUrlForOwnedAsset(entity.getCoverAssetId(), entity.getUserId()));
            } catch (BusinessException ignored) {
                // 封面 asset 已删时不阻塞
            }
        }
        return vo;
    }

    /** 后续 GET/PUT/SSE 会复用 */
    Long requireUserId() {
        Long userId = LoginUserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(401, "未登录");
        }
        return userId;
    }

    /** 后续 GET 回显时用 */
    Map<String, Object> readActivityJson(String activityJson) {
        if (activityJson == null || activityJson.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(activityJson, new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            throw new BusinessException(500, "活动表单解析失败");
        }
    }

    /** 从 entity 直接转 VO — GET 时用 */
    private CampaignDraftVO toVO(CampaignDraft entity) {
        return toVO(entity, readActivityJson(entity.getActivityJson()));
    }

    public CampaignDraftVO getDraft(Long id) {
        Long userId = requireUserId();
        CampaignDraft draft = getOwnedDraft(id, userId);
        return toVO(draft);
    }

    @Transactional
    public CampaignDraftVO updateDraft(Long id, CampaignDraftCreateRequest request) {
        Long userId = requireUserId();
        CampaignDraft draft = getOwnedDraft(id, userId);

        Map<String, Object> activity = new LinkedHashMap<>(readActivityJson(draft.getActivityJson()));
        activity.putAll(buildActivityMap(request));
        draft.setTitle(resolveDraftTitle(request.getTheme()));
        draft.setActivityJson(writeActivityJson(activity));
        draft.setUpdatedAt(LocalDateTime.now());
        campaignDraftMapper.updateById(draft);

        return toVO(draft, activity);
    }

    private static final String DEFAULT_DRAFT_TITLE = "活动帖";

    private String resolveDraftTitle(String theme) {
        String trimmed = nullToEmpty(theme);
        return trimmed.isBlank() ? DEFAULT_DRAFT_TITLE : trimmed;
    }

    /** 只能读/改自己的草稿，防止越权访问他人 id */
    private CampaignDraft getOwnedDraft(Long id, Long userId) {
        CampaignDraft draft = campaignDraftMapper.selectById(id);
        if (draft == null || !userId.equals(draft.getUserId())) {
            throw new BusinessException(404, "草稿不存在");
        }
        return draft;
    }

    public SseEmitter streamGenerateCopy(Long draftId, CampaignGenerateCopyRequest request) {
        Long userId = requireUserId();
        CampaignDraft draft = getOwnedDraft(draftId, userId);

        String prompt = buildCopyPrompt(draft, request);
        if (prompt == null || prompt.isBlank()) {
            throw new BusinessException(400, "活动信息不足，无法生成文案");
        }
        log.debug("Campaign copy stream draftId={} mode={} promptLength={}",
                draftId, request.getMode(), prompt.length());
        SseEmitter emitter = new SseEmitter(120_000L);
        pythonAiClient.opsCopyStream(prompt, emitter);
        return emitter;
    }

    private String buildCopyPrompt(CampaignDraft draft, CampaignGenerateCopyRequest request) {
        String mode = request.getMode().trim();
        Map<String, Object> activity = readActivityJson(draft.getActivityJson());
        Map<String, String> variables = new HashMap<>();

        if ("draft".equals(mode)) {
            PromptTemplate template = promptTemplateMapper.selectOne(
                    new LambdaQueryWrapper<PromptTemplate>()
                            .eq(PromptTemplate::getScene, "copy_draft")
                            .isNull(PromptTemplate::getUserId)
                            .last("LIMIT 1")
            );
            if (template == null) {
                throw new BusinessException(500, "未找到 copy_draft 内置模板");
            }
            // 与 seed 模板 {{theme}} 等占位符对齐
            variables.put("theme", str(activity.get("theme")));
            variables.put("timeRange", str(activity.get("timeRange")));
            variables.put("benefits", str(activity.get("benefits")));
            variables.put("audience", str(activity.get("audience")));
            return pythonAiClient.renderPrompt(template.getContent(), variables);
        }

        if ("refine".equals(mode)) {
            if (request.getStyleTemplateId() == null) {
                throw new BusinessException(400, "refine 模式需要 styleTemplateId");
            }
            if (draft.getCopyBody() == null || draft.getCopyBody().isBlank()) {
                throw new BusinessException(400, "请先生成文案初稿");
            }
            PromptTemplate template = promptTemplateMapper.selectById(request.getStyleTemplateId());
            Long userId = requireUserId();
            if (template == null || !canAccessPrompt(template, userId)) {
                throw new BusinessException(404, "风格模板不存在");
            }
            String copy = (draft.getCopyTitle() != null ? draft.getCopyTitle() + "\n" : "")
                    + draft.getCopyBody();
            variables.put("copy", copy);
            variables.put("hint", request.getHint() != null ? request.getHint().trim() : "");
            return pythonAiClient.renderPrompt(template.getContent(), variables);
        }

        throw new BusinessException(400, "mode 必须是 draft 或 refine");
    }

    private String str(Object v) {
        return v == null ? "" : v.toString();
    }

    /** 与 PromptTemplateService 可见规则一致 */
    private boolean canAccessPrompt(PromptTemplate template, Long userId) {
        return template.getUserId() == null || userId.equals(template.getUserId());
    }

    /**
     * SSE 流结束后由前端调用 — 写入 copy_title / copy_body。
     * 与 updateDraft（左栏表单）分离，避免 PUT /{id} 职责混乱。
     */
    @Transactional
    public CampaignDraftVO saveCopy(Long id, CampaignCopySaveRequest request) {
        Long userId = requireUserId();
        CampaignDraft draft = getOwnedDraft(id, userId);

        draft.setCopyTitle(request.getCopyTitle().trim());
        draft.setCopyBody(request.getCopyBody().trim());
        draft.setUpdatedAt(LocalDateTime.now());
        campaignDraftMapper.updateById(draft);

        return toVO(draft);
    }

    /** 配图 Tab — 渲染 image_gen 模板并调 Python 生图候选 */
    @Transactional
    public GenerationJobVO generateImages(Long id, CampaignGenerateImagesRequest request) {
        Long userId = requireUserId();
        CampaignDraft draft = getOwnedDraft(id, userId);
        Map<String, Object> activity = readActivityJson(draft.getActivityJson());

        String prompt;
        if (request.getPromptOverride() != null && !request.getPromptOverride().isBlank()) {
            prompt = request.getPromptOverride().trim();
        } else {
            PromptTemplate template = promptTemplateMapper.selectOne(
                    new LambdaQueryWrapper<PromptTemplate>()
                            .eq(PromptTemplate::getScene, "image_gen")
                            .isNull(PromptTemplate::getUserId)
                            .last("LIMIT 1")
            );
            if (template == null) {
                throw new BusinessException(500, "未找到 image_gen 内置模板");
            }
            Map<String, String> vars = new HashMap<>();
            vars.put("theme", str(activity.get("theme")));
            vars.put("timeRange", str(activity.get("timeRange")));
            vars.put("audience", str(activity.get("audience")));
            vars.put("benefits", str(activity.get("benefits")));
            vars.put("visualStyle", str(activity.get("visualStyle")));
            vars.put("aspectRatio", str(activity.get("aspectRatio")));
            vars.put("forbiddenWords", str(activity.get("forbiddenWords")));
            prompt = pythonAiClient.renderPrompt(template.getContent(), vars);
        }

        String sourceUrl = null;
        if (request.getSourceAssetId() != null) {
            sourceUrl = assetService.getPublicUrlForOwnedAsset(request.getSourceAssetId(), userId);
        }
        int count = request.getCount() != null ? request.getCount() : 4;
        String aspectRatio = str(activity.get("aspectRatio"));
        return generationJobService.runJob(userId, "image_gen", null, id, prompt, sourceUrl, count, aspectRatio);
    }

    @Transactional
    public CampaignDraftVO saveImages(Long id, CampaignImagesSaveRequest request) {
        Long userId = requireUserId();
        CampaignDraft draft = getOwnedDraft(id, userId);

        List<Long> assetIds;
        if (request.getImageAssetIds() != null && !request.getImageAssetIds().isEmpty()) {
            assetIds = request.getImageAssetIds();
        } else {
            assetIds = workflowSourceService.importSelectedToAssets(
                    WorkflowSourceService.CONTEXT_CAMPAIGN,
                    null,
                    id,
                    userId,
                    List.of("generated", "campaign"));
        }

        if (!assetIds.isEmpty()) {
            draft.setCoverAssetId(request.getCoverAssetId() != null ? request.getCoverAssetId() : assetIds.get(0));
            try {
                draft.setImageAssetIds(objectMapper.writeValueAsString(assetIds));
            } catch (JsonProcessingException e) {
                throw new BusinessException(500, "附图序列化失败");
            }
        } else if (request.getCoverAssetId() != null) {
            draft.setCoverAssetId(request.getCoverAssetId());
        }

        draft.setStatus("ready");
        draft.setUpdatedAt(LocalDateTime.now());
        campaignDraftMapper.updateById(draft);
        return toVO(draft);
    }

    /** 导出草稿包 zip：文案 md + 封面/附图文件 */
    public byte[] exportDraft(Long id) {
        Long userId = requireUserId();
        CampaignDraft draft = getOwnedDraft(id, userId);
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream();
             ZipOutputStream zos = new ZipOutputStream(baos)) {
            String md = "# " + (draft.getCopyTitle() != null ? draft.getCopyTitle() : draft.getTitle()) + "\n\n"
                    + (draft.getCopyBody() != null ? draft.getCopyBody() : "");
            zos.putNextEntry(new ZipEntry("copy.md"));
            zos.write(md.getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();

            if (draft.getCoverAssetId() != null) {
                addAssetToZip(zos, draft.getCoverAssetId(), "cover" + extOfAsset(draft.getCoverAssetId()));
            }
            List<Long> extras = readImageAssetIds(draft.getImageAssetIds());
            for (int i = 0; i < extras.size(); i++) {
                addAssetToZip(zos, extras.get(i), "image-" + (i + 1) + extOfAsset(extras.get(i)));
            }
            zos.finish();
            return baos.toByteArray();
        } catch (IOException e) {
            throw new BusinessException(500, "导出失败");
        }
    }

    private void addAssetToZip(ZipOutputStream zos, Long assetId, String entryName) throws IOException {
        Asset asset = assetMapper.selectById(assetId);
        if (asset == null) {
            return;
        }
        Path file = Paths.get(uploadProperties.getDir()).resolve(asset.getUrl().replace("/uploads/", ""));
        if (!Files.exists(file)) {
            return;
        }
        zos.putNextEntry(new ZipEntry(entryName));
        Files.copy(file, zos);
        zos.closeEntry();
    }

    private String extOfAsset(Long assetId) {
        Asset asset = assetMapper.selectById(assetId);
        if (asset == null || asset.getName() == null || !asset.getName().contains(".")) {
            return ".png";
        }
        return asset.getName().substring(asset.getName().lastIndexOf('.'));
    }

    private List<Long> readImageAssetIds(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            return List.of();
        }
    }
}