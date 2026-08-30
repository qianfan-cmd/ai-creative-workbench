package com.workbench.backendjava.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.workbench.backendjava.common.BusinessException;
import com.workbench.backendjava.common.LoginUserContext;
import com.workbench.backendjava.dto.PromptTemplateCreateRequest;
import com.workbench.backendjava.dto.PromptTemplateUpdateRequest;
import com.workbench.backendjava.entity.PromptTemplate;
import com.workbench.backendjava.mapper.PromptTemplateMapper;
import com.workbench.backendjava.vo.PromptTemplateVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 提示词模板
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PromptTemplateService {

    private final PromptTemplateMapper promptTemplateMapper;

    /**
     * 列表查询。scene 可选：不传则返回当前用户可见的全部模板。
     * 可见规则：系统内置（userId=null）或 属于当前登录用户。
     */
    public List<PromptTemplateVO> listTemplates(String scene) {
        Long userId = requireUserId();

        LambdaQueryWrapper<PromptTemplate> wrapper = new LambdaQueryWrapper<>();

        // 系统模板或自己的模板
        wrapper.and(w -> w.isNull(PromptTemplate::getUserId)
                .or()
                .eq(PromptTemplate::getUserId, userId))
                .orderByAsc(PromptTemplate::getScene)
                .orderByAsc(PromptTemplate::getId);

        if (StringUtils.hasText(scene)) {
            wrapper.eq(PromptTemplate::getScene, scene.trim());
        }

        return promptTemplateMapper.selectList(wrapper).stream()
                .map(this::toVO)
                .collect(Collectors.toList());
    }

    /**
     * 按 id 查单条， 并校验当前用户是否有权查看
     * @return
     */
    public PromptTemplateVO getTemplate(Long id) {
        Long userId = requireUserId();
        PromptTemplate template = promptTemplateMapper.selectById(id);
        if (template == null || !canAccess(template, userId)) {
            throw new BusinessException(404, "模板不存在");
        }
        return toVO(template);
    }

    /**
     * 系统内置模板所有人可见，用户模板本人可见
     * @return
     */
    private boolean canAccess(PromptTemplate template, Long userId) {
        return template.getUserId() == null || userId.equals(template.getUserId());
    }

    private Long requireUserId() {
        Long userId = LoginUserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(401, "未登录");
        }
        return userId;
    }

    private PromptTemplateVO toVO(PromptTemplate entity) {
        PromptTemplateVO vo = new PromptTemplateVO();
        vo.setId(entity.getId());
        vo.setUserId(entity.getUserId());
        vo.setName(entity.getName());
        vo.setScene(entity.getScene());
        vo.setContent(entity.getContent());
        vo.setCreatedAt(entity.getCreatedAt());
        vo.setUpdatedAt(entity.getUpdatedAt());
        return vo;
    }

    /**
     * 用户创建自定义模板 -> 自动绑定当前userId
     */
    public PromptTemplateVO createTemplate(PromptTemplateCreateRequest request) {
        Long userId = requireUserId();

        PromptTemplate entity = new PromptTemplate();
        entity.setUserId(userId);
        entity.setName(request.getName().trim());
        entity.setScene(request.getScene().trim());
        entity.setContent(request.getContent());
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        promptTemplateMapper.insert(entity);
        return toVO(entity);
    }

    /**
     * 仅允许本人修改模板
     */
    public PromptTemplateVO updateTemplate(Long id, PromptTemplateUpdateRequest request) {
        Long userId = requireUserId();
        PromptTemplate entity = promptTemplateMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException(404, "模板不存在");
        }
        if (entity.getUserId() == null) {
            throw new BusinessException(403, "系统内置模板不可修改");
        }
        if (!userId.equals(entity.getUserId())) {
            throw new BusinessException(403, "无权修改该模板");
        }

        entity.setName(request.getName().trim());
        entity.setScene(request.getScene().trim());
        entity.setContent(request.getContent());
        entity.setUpdatedAt(LocalDateTime.now());
        promptTemplateMapper.updateById(entity);
        return toVO(entity);
    }

    /** 软删除 — 同样禁止删系统内置 */
    @Transactional
    public void deleteTemplate(Long id) {
        Long userId = requireUserId();
        PromptTemplate entity = promptTemplateMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException(404, "模板不存在");
        }
        if (entity.getUserId() == null) {
            throw new BusinessException(403, "系统内置模板不可删除");
        }
        if (!userId.equals(entity.getUserId())) {
            throw new BusinessException(403, "无权删除该模板");
        }
        promptTemplateMapper.deleteById(id);
    }
}
