package com.workbench.backendjava.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.workbench.backendjava.common.BusinessException;
import com.workbench.backendjava.common.LoginUserContext;
import com.workbench.backendjava.common.PageResult;
import com.workbench.backendjava.config.AppProperties;
import com.workbench.backendjava.entity.Asset;
import com.workbench.backendjava.mapper.AssetMapper;
import com.workbench.backendjava.vo.AssetUploadVO;
import com.workbench.backendjava.vo.AssetVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AssetService {

    private final AssetMapper assetMapper;
    private final FileStorageService fileStorageService;
    private final AppProperties appProperties;

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
    public PageResult<AssetVO> listPage(long page, long size) {
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
        wrapper.eq(Asset::getUserId, userId)
                .orderByDesc(Asset::getCreatedAt);

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
        return vo;
    }
}
