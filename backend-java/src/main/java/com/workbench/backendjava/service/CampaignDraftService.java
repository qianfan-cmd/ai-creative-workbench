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
import com.workbench.backendjava.dto.CampaignGenerateCopyRequest;
import com.workbench.backendjava.entity.CampaignDraft;
import com.workbench.backendjava.entity.PromptTemplate;
import com.workbench.backendjava.mapper.CampaignDraftMapper;
import com.workbench.backendjava.mapper.PromptTemplateMapper;
import com.workbench.backendjava.vo.CampaignDraftVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class CampaignDraftService {

    private final CampaignDraftMapper campaignDraftMapper;
    private final ObjectMapper objectMapper;
    private final PromptTemplateMapper promptTemplateMapper;
    private final PythonAiClient pythonAiClient;

    @Transactional
    public CampaignDraftVO createDraft(CampaignDraftCreateRequest request) {
        Long userId = requireUserId();

        // 表单字段 → Map → JSON 字符串入库
        Map<String, Object> activity = buildActivityMap(request);
        String activityJson = writeActivityJson(activity);

        CampaignDraft draft = new CampaignDraft();
        draft.setUserId(userId);
        draft.setTitle(request.getTheme().trim());
        draft.setActivityJson(activityJson);
        draft.setStatus("draft");
        draft.setCreatedAt(LocalDateTime.now());
        draft.setUpdatedAt(LocalDateTime.now());
        campaignDraftMapper.insert(draft);

        return toVO(draft, activity);
    }

    private Map<String, Object> buildActivityMap(CampaignDraftCreateRequest req) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("theme", req.getTheme().trim());
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

        Map<String, Object> activity = buildActivityMap(request);
        draft.setTitle(request.getTheme().trim());
        draft.setActivityJson(writeActivityJson(activity));
        draft.setUpdatedAt(LocalDateTime.now());
        campaignDraftMapper.updateById(draft);

        return toVO(draft, activity);
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
}