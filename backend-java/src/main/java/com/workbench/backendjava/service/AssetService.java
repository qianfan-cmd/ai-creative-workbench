package com.workbench.backendjava.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.workbench.backendjava.common.BusinessException;
import com.workbench.backendjava.common.LoginUserContext;
import com.workbench.backendjava.common.PageResult;
import com.workbench.backendjava.config.AppProperties;
import com.workbench.backendjava.dto.AssetTagsUpdateRequest;
import com.workbench.backendjava.dto.AssetUpdateRequest;
import com.workbench.backendjava.entity.Asset;
import com.workbench.backendjava.entity.AssetTag;
import com.workbench.backendjava.entity.Tag;
import com.workbench.backendjava.mapper.AssetMapper;
import com.workbench.backendjava.mapper.AssetTagMapper;
import com.workbench.backendjava.mapper.TagMapper;
import com.workbench.backendjava.vo.AssetStatsVO;
import com.workbench.backendjava.vo.AssetUploadVO;
import com.workbench.backendjava.vo.AssetVO;
import com.workbench.backendjava.vo.TagVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AssetService {

    private final AssetMapper assetMapper;
    private final FileStorageService fileStorageService;
    private final AppProperties appProperties;

    private final TagMapper tagMapper;
    private final AssetTagMapper assetTagMapper;
    private final KnowledgeService knowledgeService;

    /**
     * 上传文件落库
     * @param file
     * @return
     */
    public AssetUploadVO upload(MultipartFile file) {
        Long userId = LoginUserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(401, "未登录");
        }

        String path = fileStorageService.store(file);

        Asset asset = new Asset();
        asset.setUserId(userId);
        asset.setName(file.getOriginalFilename());
        asset.setType(file.getContentType());
        asset.setUrl(path);
        asset.setSize(file.getSize());

        assetMapper.insert(asset);
        log.info("素材入库, userId={}, assetId={}", userId, asset.getId());

        AssetUploadVO vo = new AssetUploadVO();
        vo.setId(asset.getId());
        vo.setName(asset.getName());
        vo.setUrl(buildFullUrl(path));
        vo.setPath(path);
        vo.setSize(asset.getSize());
        vo.setType(asset.getType());
        return vo;
    }

    /**
     * 构建完整的访问路径
     * @param path
     * @return
     */
    private String buildFullUrl(String path) {
        String base = appProperties.getPublicBaseUrl();
        if (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        return base + path;
    }

    /**
     * 分页查询当前用户的素材列表
     */
    public PageResult<AssetVO> listPage(long page, long size, Long tagId, String keyword, String type, String sort) {
        Long userId = LoginUserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(401, "未登录");
        }

        // 素材保护，页码至少1，每页1~100条
        if (page < 1) {
            page = 1;
        }
        if (size < 1) {
            size = 10;
        }
        if (size > 100) {
            size = 100;
        }

        // 初始化分页参数对象
        Page<Asset> mpPage = new Page<>(page, size);

        // 构建条件构造器
        /**
         * 相当于WHERE user_id = ? ORDER BY created_at DESC
         */
        LambdaQueryWrapper<Asset> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Asset::getUserId, userId);

        // 按关键字筛选
        if (keyword != null && !keyword.isBlank()) {
            wrapper.like(Asset::getName, keyword);
        }

        // 按类型筛选
        if (type != null && !type.isBlank()) {
            wrapper.eq(Asset::getType, type);
        }

        // 按标签筛选
        if (tagId != null) {
            // 标签不存在 404
            Tag tag = tagMapper.selectById(tagId);
            if (tag == null) {
                throw new BusinessException(404, "标签不存在");
            }

            // 查关联表，汇总该标签下的所有assetId
            List<AssetTag> relations = assetTagMapper.selectList(
                    new LambdaQueryWrapper<AssetTag>()
                            .eq(AssetTag::getTagId, tagId)
            );

            if (relations.isEmpty()) {
                // 没有绑定该标签的素材，返回空页面
                return PageResult.of(List.of(), 0, page, size);
            }

            List<Long> assetIds = relations.stream()
                    .map(AssetTag::getAssetId)
                    .collect(Collectors.toList());

            wrapper.in(Asset::getId, assetIds);
        }

        // 按创建时间排序（可选，默认 desc）
        if (sort != null && "asc".equalsIgnoreCase(sort.trim())) {
            wrapper.orderByAsc(Asset::getCreatedAt);
        } else {
            // desc 或未传、乱传都按最新在前
            wrapper.orderByDesc(Asset::getCreatedAt);
        }

        // 分页查询（会自动拼接LiMIT: @TableLogic 会过滤 deleted = 1)
        Page<Asset> resultPage = assetMapper.selectPage(mpPage, wrapper);

        // Entity -> VO
        List<AssetVO> voList = resultPage.getRecords().stream()
                .map(asset -> toAssetVO(asset))
                .collect(Collectors.toList());

        return PageResult.of(voList, resultPage.getTotal(), resultPage.getCurrent(), resultPage.getSize());
    }

    /**
     * Entity -> VO
     */
    private AssetVO toAssetVO(Asset asset) {
        AssetVO vo = new AssetVO();
        vo.setId(asset.getId());
        vo.setName(asset.getName());
        vo.setUrl(buildFullUrl(asset.getUrl()));
        vo.setPath(asset.getUrl());
        vo.setSize(asset.getSize());
        vo.setType(asset.getType());
        vo.setCreatedAt(asset.getCreatedAt());
        vo.setTags(loadTagsForAsset(asset.getId()));
        return vo;
    }

    /**
     * 查询当前用户的素材详情
     */
    public AssetVO getDetail(Long id) {
        Long userId = LoginUserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(401, "未登录");
        }

        Asset asset = assetMapper.selectById(id);

        // 不存在，或不属于当前用户，统一404
        if (asset == null || !asset.getUserId().equals(userId)) {
            throw new BusinessException(404, "素材不存在");
        }

        return toAssetVO(asset);
    }

    /**
     * 逻辑删除用户素材
     */
    public void delete(Long id) {
        Long userId = LoginUserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(401, "未登录");
        }

        Asset asset = assetMapper.selectById(id);

        if (asset == null || !asset.getUserId().equals(userId)) {
            throw new BusinessException(404, "素材不存在");
        }

        assetMapper.deleteById(id);
        log.info("素材删除, userId={}, assetId={}", userId, id);
    }

    /**
     * 给素材绑定标签
     */
    public void bindTag(Long assetId, Long tagId) {
        Long userId = LoginUserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(401, "未登录");
        }

        // 校验素材：存在且属于当前用户
        Asset asset = assetMapper.selectById(assetId);
        if (asset == null || !asset.getUserId().equals(userId)) {
            throw new BusinessException(404, "素材不存在");
        }

        // 校验标签是否存在
        Tag tag = tagMapper.selectById(tagId);
        if (tag == null) {
            throw new BusinessException(404, "标签不存在");
        }

        // 不能重复绑定同一对素材和标签
        AssetTag exist = assetTagMapper.selectOne(
                new LambdaQueryWrapper<AssetTag>()
                        .eq(AssetTag::getAssetId, assetId)
                        .eq(AssetTag::getTagId, tagId)
        );
        if (exist != null) {
            throw new BusinessException(409, "素材和标签已绑定");
        }

        // 写入关联表
        AssetTag assetTag = new AssetTag();
        assetTag.setAssetId(assetId);
        assetTag.setTagId(tagId);
        assetTagMapper.insert(assetTag);

        log.info("素材绑定标签, userId={}, assetId={}, tagId={}", userId, assetId, tagId);
    }

    /**
     * 获取kpi卡片显示数据
     */
    public AssetStatsVO getStats() {
        Long userId = LoginUserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(401, "未登录");
        }

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime last7Start = now.minusDays(7);
        LocalDateTime prev7Start = now.minusDays(14);


        Long total = assetMapper.selectCount(
                new LambdaQueryWrapper<Asset>().eq(Asset::getUserId, userId)
        );

        /**
         * 过去7天的素材
         */
        Long last7DaysCount = assetMapper.selectCount(
                new LambdaQueryWrapper<Asset>()
                        .eq(Asset::getUserId, userId)
                        .ge(Asset::getCreatedAt, last7Start)
        );

        Long prev7DaysCount = assetMapper.selectCount(
                new LambdaQueryWrapper<Asset>()
                        .eq(Asset::getUserId, userId)
                        .ge(Asset::getCreatedAt, prev7Start)
                        .lt(Asset::getCreatedAt, last7Start)
        );

        AssetStatsVO vo = new AssetStatsVO();
        vo.setTotal(total);
        vo.setLast7DaysCount(last7DaysCount);
        vo.setPrev7DaysCount(prev7DaysCount);
        vo.setKnowledgeDocCount((long) knowledgeService.listDocuments().size());
        return vo;
    }


    private List<TagVO> loadTagsForAsset(Long assetId) {
        List<AssetTag> relations = assetTagMapper.selectList(
                new LambdaQueryWrapper<AssetTag>()
                        .eq(AssetTag::getAssetId, assetId)
        );
        if ( relations.isEmpty()) {
            return Collections.emptyList();
        }

        List<Long> tagIds = relations.stream()
                .map(AssetTag::getTagId)
                .collect(Collectors.toList());

        return tagMapper.selectBatchIds(tagIds).stream()
                .map(this::toTagVO)
                .collect(Collectors.toList());
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
     * 素材重命名
     * @param id
     * @param request
     * @return
     */
    public AssetVO updateName(Long id, AssetUpdateRequest request) {
        Long userId = LoginUserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(401, "未登录");
        }

        Asset asset = assetMapper.selectById(id);
        if (asset == null || !asset.getUserId().equals(userId)) {
            throw new BusinessException(404, "素材不存在");
        }

        asset.setName(request.getName().trim());
        assetMapper.updateById(asset);
        log.info("素材改名, userId={}, assetId={}, name={}", userId, id, asset.getName());

        return toAssetVO(asset);
    }

    /**
     * 修改标签（批量替换）
     */
    @Transactional
    public void replaceTags(Long assetId, AssetTagsUpdateRequest request) {
        Long userId = LoginUserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(401, "未登录");
        }

        Asset asset = assetMapper.selectById(assetId);
        if (asset == null || !asset.getUserId().equals(userId)) {
            throw new BusinessException(404, "素材不存在");
        }

        List<Long> tagIds = request.getTagIds() != null ? request.getTagIds() : List.of();

        // 校验标签是否都存在
        for (Long tagId : tagIds) {
            Tag tag = tagMapper.selectById(tagId);
            if (tag == null) {
                throw new BusinessException(404, "标签不存在：" + tagId);
            }
        }

        // 删掉旧关联，写入新关联
        assetTagMapper.delete(
                new LambdaQueryWrapper<AssetTag>()
                        .eq(AssetTag::getAssetId, assetId)
        );

        for (Long tagId : tagIds) {
            AssetTag assetTag = new AssetTag();
            assetTag.setAssetId(assetId);
            assetTag.setTagId(tagId);
            assetTagMapper.insert(assetTag);
        }

        log.info("素材标签更新, userId={}, assetId={}, tagIds={}", userId, assetId, tagIds);
    }
}
