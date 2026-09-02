package com.workbench.backendjava.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.workbench.backendjava.common.BusinessException;
import com.workbench.backendjava.common.LoginUserContext;
import com.workbench.backendjava.dto.MattingTaskGroupCreateRequest;
import com.workbench.backendjava.dto.MattingTaskGroupPatchRequest;
import com.workbench.backendjava.entity.OpsMattingTask;
import com.workbench.backendjava.entity.OpsMattingTaskGroup;
import com.workbench.backendjava.mapper.OpsMattingTaskGroupMapper;
import com.workbench.backendjava.mapper.OpsMattingTaskMapper;
import com.workbench.backendjava.vo.MattingTaskGroupVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MattingTaskGroupService {

    private final OpsMattingTaskGroupMapper groupMapper;
    private final OpsMattingTaskMapper taskMapper;

    public List<MattingTaskGroupVO> listGroups() {
        return listGroups(requireUserId());
    }

    @Transactional
    public MattingTaskGroupVO createGroup(MattingTaskGroupCreateRequest request) {
        Long userId = requireUserId();
        String name = request.getName().trim();
        if (name.isEmpty()) {
            throw new BusinessException(400, "分组名称不能为空");
        }

        Integer maxSort = groupMapper.selectList(
                new LambdaQueryWrapper<OpsMattingTaskGroup>()
                        .eq(OpsMattingTaskGroup::getUserId, userId)
                        .orderByDesc(OpsMattingTaskGroup::getSortOrder)
                        .last("LIMIT 1")
        ).stream().map(OpsMattingTaskGroup::getSortOrder).findFirst().orElse(-1);

        OpsMattingTaskGroup group = new OpsMattingTaskGroup();
        group.setUserId(userId);
        group.setName(name);
        group.setSortOrder(maxSort + 1);
        group.setCreatedAt(LocalDateTime.now());
        group.setUpdatedAt(LocalDateTime.now());
        groupMapper.insert(group);
        return toVO(group);
    }

    @Transactional
    public MattingTaskGroupVO patchGroup(Long id, MattingTaskGroupPatchRequest request) {
        Long userId = requireUserId();
        OpsMattingTaskGroup group = getOwnedGroup(id, userId);

        if (request.getName() != null) {
            String name = request.getName().trim();
            if (name.isEmpty()) {
                throw new BusinessException(400, "分组名称不能为空");
            }
            group.setName(name);
        }
        if (request.getSortOrder() != null) {
            group.setSortOrder(request.getSortOrder());
        }
        group.setUpdatedAt(LocalDateTime.now());
        groupMapper.updateById(group);
        return toVO(group);
    }

    @Transactional
    public void deleteGroup(Long id) {
        Long userId = requireUserId();
        getOwnedGroup(id, userId);

        taskMapper.update(
                null,
                new LambdaUpdateWrapper<OpsMattingTask>()
                        .eq(OpsMattingTask::getUserId, userId)
                        .eq(OpsMattingTask::getGroupId, id)
                        .set(OpsMattingTask::getGroupId, null)
                        .set(OpsMattingTask::getUpdatedAt, LocalDateTime.now())
        );
        groupMapper.deleteById(id);
    }

    public OpsMattingTaskGroup getOwnedGroup(Long id, Long userId) {
        OpsMattingTaskGroup group = groupMapper.selectById(id);
        if (group == null || !userId.equals(group.getUserId())) {
            throw new BusinessException(404, "分组不存在");
        }
        return group;
    }

    private List<MattingTaskGroupVO> listGroups(Long userId) {
        return groupMapper.selectList(
                new LambdaQueryWrapper<OpsMattingTaskGroup>()
                        .eq(OpsMattingTaskGroup::getUserId, userId)
                        .orderByAsc(OpsMattingTaskGroup::getSortOrder)
                        .orderByAsc(OpsMattingTaskGroup::getId)
        ).stream().map(this::toVO).collect(Collectors.toList());
    }

    private MattingTaskGroupVO toVO(OpsMattingTaskGroup group) {
        MattingTaskGroupVO vo = new MattingTaskGroupVO();
        vo.setId(group.getId());
        vo.setName(group.getName());
        vo.setSortOrder(group.getSortOrder());
        vo.setUpdatedAt(group.getUpdatedAt());
        return vo;
    }

    private Long requireUserId() {
        Long userId = LoginUserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(401, "未登录");
        }
        return userId;
    }
}
