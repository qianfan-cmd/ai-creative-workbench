package com.workbench.backendjava.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.workbench.backendjava.common.BusinessException;
import com.workbench.backendjava.common.LoginUserContext;
import com.workbench.backendjava.common.PageResult;
import com.workbench.backendjava.common.UserRole;
import com.workbench.backendjava.common.UserStatus;
import com.workbench.backendjava.dto.AdminUserCreateRequest;
import com.workbench.backendjava.dto.AdminUserUpdateRequest;
import com.workbench.backendjava.entity.AiCallLog;
import com.workbench.backendjava.entity.User;
import com.workbench.backendjava.mapper.AiCallLogMapper;
import com.workbench.backendjava.mapper.UserMapper;
import com.workbench.backendjava.vo.AdminUserDetailVO;
import com.workbench.backendjava.vo.AdminUserListItemVO;
import com.workbench.backendjava.config.AiPricingProperties;
import com.workbench.backendjava.vo.CostRange;
import com.workbench.backendjava.vo.UserUsageSummaryVO;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.BeanUtils;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminUserService {

    private static final int PASSWORD_MIN_LENGTH = 6;

    private final UserMapper userMapper;
    private final AiCallLogMapper aiCallLogMapper;
    private final PasswordEncoder passwordEncoder;
    private final UsageCostCalculator usageCostCalculator;
    private final AiPricingProperties aiPricingProperties;

    public PageResult<AdminUserListItemVO> listUsers(long page, long size, String keyword) {
        LoginUserContext.requireAdmin();

        LambdaQueryWrapper<User> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w.like(User::getUsername, keyword).or().like(User::getEmail, keyword));
        }
        wrapper.orderByDesc(User::getCreatedAt);

        Page<User> result = userMapper.selectPage(new Page<>(page, size), wrapper);
        List<AdminUserListItemVO> records = result.getRecords().stream()
                .map(this::toListItemVO)
                .collect(Collectors.toList());
        return PageResult.of(records, result.getTotal(), page, size);
    }

    public AdminUserDetailVO getUser(Long id) {
        LoginUserContext.requireAdmin();
        User user = requireUser(id);
        return toDetailVO(user);
    }

    public AdminUserDetailVO createUser(AdminUserCreateRequest request) {
        LoginUserContext.requireAdmin();
        validateRole(request.getRole());
        validatePassword(request.getPassword());
        assertUsernameAvailable(request.getUsername(), null);
        assertEmailAvailable(request.getEmail(), null);

        User user = new User();
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setRole(request.getRole());
        user.setStatus(UserStatus.ACTIVE);
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        userMapper.insert(user);
        return toDetailVO(user);
    }

    public AdminUserDetailVO updateUser(Long id, AdminUserUpdateRequest request) {
        LoginUserContext.requireAdmin();
        validateRole(request.getRole());
        validateStatus(request.getStatus());

        User user = requireUser(id);
        Long currentUserId = LoginUserContext.getUserId();

        if (UserStatus.DISABLED.equals(request.getStatus()) && id.equals(currentUserId)) {
            throw new BusinessException("不能禁用当前登录账号");
        }
        if (UserRole.USER.equals(request.getRole()) && UserRole.ADMIN.equals(user.getRole()) && id.equals(currentUserId)) {
            throw new BusinessException("不能降级当前登录管理员");
        }
        if (UserRole.USER.equals(request.getRole()) && UserRole.ADMIN.equals(user.getRole())) {
            assertNotLastAdmin(id);
        }
        if (UserStatus.DISABLED.equals(request.getStatus()) && UserRole.ADMIN.equals(user.getRole())) {
            assertNotLastActiveAdmin(id);
        }

        assertUsernameAvailable(request.getUsername(), id);
        assertEmailAvailable(request.getEmail(), id);

        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setRole(request.getRole());
        user.setStatus(request.getStatus());
        if (StringUtils.hasText(request.getPassword())) {
            validatePassword(request.getPassword());
            user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        }
        user.setUpdatedAt(LocalDateTime.now());
        userMapper.updateById(user);
        return toDetailVO(user);
    }

    public void disableUser(Long id) {
        LoginUserContext.requireAdmin();
        User user = requireUser(id);
        Long currentUserId = LoginUserContext.getUserId();

        if (id.equals(currentUserId)) {
            throw new BusinessException("不能禁用当前登录账号");
        }
        if (UserRole.ADMIN.equals(user.getRole())) {
            assertNotLastActiveAdmin(id);
        }

        user.setStatus(UserStatus.DISABLED);
        user.setUpdatedAt(LocalDateTime.now());
        userMapper.updateById(user);
    }

    public UserUsageSummaryVO getUserUsage(Long userId, int days) {
        LoginUserContext.requireAdmin();
        requireUser(userId);

        int safeDays = Math.max(1, Math.min(days, 365));
        LocalDateTime since = LocalDateTime.now().minusDays(safeDays);

        List<AiCallLog> logs = aiCallLogMapper.selectList(
                new LambdaQueryWrapper<AiCallLog>()
                        .eq(AiCallLog::getUserId, userId)
                        .ge(AiCallLog::getCreatedAt, since)
                        .eq(AiCallLog::getStatus, "success")
        );

        Map<String, UserUsageSummaryVO.ModelUsageVO> modelMap = new HashMap<>();
        Map<String, UserUsageSummaryVO.SceneUsageVO> sceneMap = new HashMap<>();
        long totalTokens = 0;
        CostRange totalCostRange = CostRange.zero();

        for (AiCallLog log : logs) {
            String scene = log.getScene() != null ? log.getScene() : "unknown";
            UsageCostCalculator.EffectiveUsage effective = usageCostCalculator.resolveEffectiveUsage(
                    log.getModel(), log.getProvider(), scene);
            String groupKey = usageCostCalculator.normalizeGroupKey(
                    log.getModel(), log.getProvider(), scene);

            UserUsageSummaryVO.ModelUsageVO modelUsage = modelMap.computeIfAbsent(groupKey, k -> {
                UserUsageSummaryVO.ModelUsageVO vo = new UserUsageSummaryVO.ModelUsageVO();
                vo.setModel(groupKey);
                vo.setModelDisplayName(AiUsageLabels.modelDisplayName(groupKey));
                vo.setProvider(effective.provider());
                String sourceUrl = usageCostCalculator.resolveSourceUrlByPricingKey(k);
                vo.setSourceUrl(sourceUrl);
                vo.setSourceStatus(StringUtils.hasText(sourceUrl) ? "official" : "missing_pricing");
                vo.setEstimatedCostCny(BigDecimal.ZERO);
                vo.setEstimatedCostCnyMin(BigDecimal.ZERO);
                vo.setEstimatedCostCnyMax(BigDecimal.ZERO);
                return vo;
            });
            modelUsage.setCallCount(modelUsage.getCallCount() + 1);
            modelUsage.setPromptTokens(modelUsage.getPromptTokens() + intVal(log.getPromptTokens()));
            modelUsage.setCompletionTokens(modelUsage.getCompletionTokens() + intVal(log.getCompletionTokens()));
            modelUsage.setTotalTokens(modelUsage.getTotalTokens() + intVal(log.getTotalTokens()));

            UserUsageSummaryVO.SceneUsageVO sceneUsage = sceneMap.computeIfAbsent(scene, k -> {
                UserUsageSummaryVO.SceneUsageVO vo = new UserUsageSummaryVO.SceneUsageVO();
                vo.setScene(scene);
                vo.setSceneLabel(AiUsageLabels.sceneLabel(scene));
                vo.setEstimatedCostCny(BigDecimal.ZERO);
                vo.setEstimatedCostCnyMin(BigDecimal.ZERO);
                vo.setEstimatedCostCnyMax(BigDecimal.ZERO);
                return vo;
            });
            sceneUsage.setCallCount(sceneUsage.getCallCount() + 1);
            sceneUsage.setTotalTokens(sceneUsage.getTotalTokens() + intVal(log.getTotalTokens()));

            CostRange costRange = usageCostCalculator.estimateCostRange(
                    log.getModel(), log.getProvider(), scene,
                    log.getPromptTokens(), log.getCompletionTokens(), log.getTotalTokens(),
                    log.getImageCount());
            modelUsage.setEstimatedCostCnyMin(modelUsage.getEstimatedCostCnyMin().add(costRange.getMinCny()));
            modelUsage.setEstimatedCostCnyMax(modelUsage.getEstimatedCostCnyMax().add(costRange.getMaxCny()));
            modelUsage.setEstimatedCostCny(modelUsage.getEstimatedCostCnyMax());
            sceneUsage.setEstimatedCostCnyMin(sceneUsage.getEstimatedCostCnyMin().add(costRange.getMinCny()));
            sceneUsage.setEstimatedCostCnyMax(sceneUsage.getEstimatedCostCnyMax().add(costRange.getMaxCny()));
            sceneUsage.setEstimatedCostCny(sceneUsage.getEstimatedCostCnyMax());
            totalCostRange = totalCostRange.add(costRange);
            totalTokens += intVal(log.getTotalTokens());
        }

        UserUsageSummaryVO summary = new UserUsageSummaryVO();
        summary.setDays(safeDays);
        summary.setTotalTokens(totalTokens);
        summary.setTotalCostCnyMin(totalCostRange.getMinCny());
        summary.setTotalCostCnyMax(totalCostRange.getMaxCny());
        summary.setTotalCostCny(totalCostRange.getMaxCny());
        summary.setByModel(new ArrayList<>(modelMap.values()));
        summary.setByScene(new ArrayList<>(sceneMap.values()));
        summary.setPricingSources(aiPricingProperties.listPricingSources().stream().map(item -> {
            UserUsageSummaryVO.PricingSourceVO vo = new UserUsageSummaryVO.PricingSourceVO();
            vo.setModel(item.getModel());
            vo.setSourceUrl(item.getSourceUrl());
            vo.setFormula(item.getFormula());
            return vo;
        }).collect(Collectors.toList()));
        return summary;
    }

    private void assertNotLastAdmin(Long excludeUserId) {
        long adminCount = userMapper.selectCount(
                new LambdaQueryWrapper<User>().eq(User::getRole, UserRole.ADMIN)
        );
        if (adminCount <= 1) {
            User target = userMapper.selectById(excludeUserId);
            if (target != null && UserRole.ADMIN.equals(target.getRole())) {
                throw new BusinessException("不能移除系统中最后一个管理员");
            }
        }
    }

    private void assertNotLastActiveAdmin(Long excludeUserId) {
        List<User> admins = userMapper.selectList(
                new LambdaQueryWrapper<User>()
                        .eq(User::getRole, UserRole.ADMIN)
                        .eq(User::getStatus, UserStatus.ACTIVE)
        );
        if (admins.size() <= 1 && admins.stream().anyMatch(u -> u.getId().equals(excludeUserId))) {
            throw new BusinessException("不能禁用系统中最后一个管理员");
        }
    }

    private User requireUser(Long id) {
        User user = userMapper.selectById(id);
        if (user == null) {
            throw new BusinessException(404, "用户不存在");
        }
        return user;
    }

    private void assertUsernameAvailable(String username, Long excludeUserId) {
        User existing = userMapper.selectOne(
                new LambdaQueryWrapper<User>().eq(User::getUsername, username)
        );
        if (existing != null && (excludeUserId == null || !existing.getId().equals(excludeUserId))) {
            throw new BusinessException("用户名已存在");
        }
    }

    private void assertEmailAvailable(String email, Long excludeUserId) {
        User existing = userMapper.selectOne(
                new LambdaQueryWrapper<User>().eq(User::getEmail, email)
        );
        if (existing != null && (excludeUserId == null || !existing.getId().equals(excludeUserId))) {
            throw new BusinessException("邮箱已存在");
        }
    }

    private void validatePassword(String password) {
        if (password == null || password.length() < PASSWORD_MIN_LENGTH) {
            throw new BusinessException("密码至少 " + PASSWORD_MIN_LENGTH + " 位");
        }
    }

    private void validateRole(String role) {
        if (!UserRole.USER.equals(role) && !UserRole.ADMIN.equals(role)) {
            throw new BusinessException("角色无效");
        }
    }

    private void validateStatus(String status) {
        if (!UserStatus.ACTIVE.equals(status) && !UserStatus.DISABLED.equals(status)) {
            throw new BusinessException("状态无效");
        }
    }

    private AdminUserListItemVO toListItemVO(User user) {
        AdminUserListItemVO vo = new AdminUserListItemVO();
        BeanUtils.copyProperties(user, vo);
        return vo;
    }

    private AdminUserDetailVO toDetailVO(User user) {
        AdminUserDetailVO vo = new AdminUserDetailVO();
        BeanUtils.copyProperties(user, vo);
        return vo;
    }

    private static long intVal(Integer value) {
        return value != null ? value : 0L;
    }
}
