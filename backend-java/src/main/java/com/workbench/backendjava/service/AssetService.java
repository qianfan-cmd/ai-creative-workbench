package com.workbench.backendjava.service;

import com.workbench.backendjava.common.BusinessException;
import com.workbench.backendjava.common.LoginUserContext;
import com.workbench.backendjava.config.AppProperties;
import com.workbench.backendjava.entity.Asset;
import com.workbench.backendjava.mapper.AssetMapper;
import com.workbench.backendjava.vo.AssetUploadVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

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
}
