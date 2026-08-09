package com.workbench.backendjava.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.workbench.backendjava.common.BusinessException;
import com.workbench.backendjava.common.LoginUserContext;
import com.workbench.backendjava.dto.TagCreateRequest;
import com.workbench.backendjava.entity.Tag;
import com.workbench.backendjava.mapper.TagMapper;
import com.workbench.backendjava.vo.TagVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TagService {
    /**
     * 逻辑：按name查是否存在-》存在409标签名已存在-》color是否为空，为空用默认-》insert进database-》转vo
     */

    private final TagMapper tagMapper;

    private static final String DEFAULT_COLOR = "#1677ff";

    public TagVO create(TagCreateRequest request) {
        Long userId = LoginUserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(401, "未登录");
        }

        // 查重
        Tag exist = tagMapper.selectOne(
                new LambdaQueryWrapper<Tag>()
                        .eq(Tag::getName, request.getName())
        );
        if (exist != null) {
            throw new BusinessException(409, "标签名已存在");
        }

        Tag tag = new Tag();
        tag.setName(request.getName());
        tag.setColor(request.getColor() != null ? request.getColor() : DEFAULT_COLOR);
        tagMapper.insert(tag);
        log.info("标签创建成功，tagId{}, name={}", tag.getId(), tag.getName());

        return toTagVO(tag);
    }

    private TagVO toTagVO(Tag tag) {
        TagVO vo = new TagVO();
        vo.setId(tag.getId());
        vo.setName(tag.getName());
        vo.setColor(tag.getColor());
        vo.setCreatedAt(tag.getCreatedAt());
        return vo;
    }

    /**
     * 查询标签列表
     */
    public List<TagVO> list() {
        Long userId = LoginUserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(401, "未登录");
        }

        LambdaQueryWrapper<Tag> wrapper = new LambdaQueryWrapper<Tag>();
        wrapper.orderByDesc(Tag::getCreatedAt);

        List<Tag> tags = tagMapper.selectList(wrapper);

        return tags.stream()
                   .map(tag -> toTagVO(tag))
                   .collect(Collectors.toList());
    }
}
