package com.workbench.backendjava.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.workbench.backendjava.common.BusinessException;
import com.workbench.backendjava.common.LoginUserContext;
import com.workbench.backendjava.common.PageResult;
import com.workbench.backendjava.config.AppProperties;
import com.workbench.backendjava.config.StorageProperties;
import com.workbench.backendjava.config.UploadProperties;
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

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.net.InetAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
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
    private final StorageProperties storageProperties;
    private final UploadProperties uploadProperties;

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
        vo.setUrl(buildPublicAssetUrl(asset));
        vo.setPath(path);
        vo.setSize(asset.getSize());
        vo.setType(asset.getType());
        return vo;
    }

    /**
     * 构建素材公网可访问 URL（local 走 app.public-base-url；未来 oss 走 CDN 域名）。
     */
    public String buildPublicAssetUrl(Asset asset) {
        if (asset == null || asset.getUrl() == null) {
            throw new BusinessException(400, "素材路径无效");
        }
        StorageProperties.Oss oss = storageProperties.getOss();
        if ("oss".equalsIgnoreCase(storageProperties.getProvider())
                && oss != null
                && oss.isEnabled()
                && oss.getPublicBaseUrl() != null
                && !oss.getPublicBaseUrl().isBlank()) {
            String base = oss.getPublicBaseUrl().endsWith("/")
                    ? oss.getPublicBaseUrl().substring(0, oss.getPublicBaseUrl().length() - 1)
                    : oss.getPublicBaseUrl();
            String key = asset.getUrl().startsWith("/") ? asset.getUrl().substring(1) : asset.getUrl();
            if (key.startsWith("uploads/")) {
                key = key.substring("uploads/".length());
            }
            return base + "/" + key;
        }
        return buildFullUrl(asset.getUrl());
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
        applyUserVisibleAssetFilter(wrapper);

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
        vo.setUrl(buildPublicAssetUrl(asset));
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
                applyUserVisibleAssetFilter(new LambdaQueryWrapper<Asset>().eq(Asset::getUserId, userId))
        );

        /**
         * 过去7天的素材
         */
        Long last7DaysCount = assetMapper.selectCount(
                applyUserVisibleAssetFilter(new LambdaQueryWrapper<Asset>()
                        .eq(Asset::getUserId, userId)
                        .ge(Asset::getCreatedAt, last7Start))
        );

        Long prev7DaysCount = assetMapper.selectCount(
                applyUserVisibleAssetFilter(new LambdaQueryWrapper<Asset>()
                        .eq(Asset::getUserId, userId)
                        .ge(Asset::getCreatedAt, prev7Start)
                        .lt(Asset::getCreatedAt, last7Start))
        );

        AssetStatsVO vo = new AssetStatsVO();
        vo.setTotal(total);
        vo.setLast7DaysCount(last7DaysCount);
        vo.setPrev7DaysCount(prev7DaysCount);
        vo.setKnowledgeDocCount(knowledgeService.countDocuments());
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

    /** 按标签名批量替换素材标签（不存在则创建） */
    @Transactional
    public void replaceTagsByNames(Long assetId, List<String> tagNames) {
        List<String> names = tagNames != null ? tagNames : List.of();
        List<Long> tagIds = names.stream()
                .filter(n -> n != null && !n.isBlank())
                .map(String::trim)
                .map(this::findOrCreateTagId)
                .collect(Collectors.toList());
        AssetTagsUpdateRequest req = new AssetTagsUpdateRequest();
        req.setTagIds(tagIds);
        replaceTags(assetId, req);
    }

    /** 当前用户素材的公网可访问 URL — 供 Python 图像 API 作 sourceUrl */
    public String getPublicUrlForOwnedAsset(Long assetId, Long userId) {
        Asset asset = assetMapper.selectById(assetId);
        if (asset == null || !asset.getUserId().equals(userId)) {
            throw new BusinessException(404, "素材不存在");
        }
        return buildPublicAssetUrl(asset);
    }

    /** 当前用户素材的文件名（Matting 来源整图描述） */
    public String getOwnedAssetName(Long assetId, Long userId) {
        Asset asset = assetMapper.selectById(assetId);
        if (asset == null || !asset.getUserId().equals(userId)) {
            throw new BusinessException(404, "素材不存在");
        }
        return asset.getName();
    }

    /** 读取当前用户已入库素材的原始字节（服务端裁切用） */
    public byte[] readOwnedAssetBytes(Long assetId, Long userId) {
        Asset asset = assetMapper.selectById(assetId);
        if (asset == null || !asset.getUserId().equals(userId)) {
            throw new BusinessException(404, "素材不存在");
        }
        return readBytesFromStoredPath(asset.getUrl());
    }

    /** 将 PNG 字节入库为当前用户的素材，返回 assetId */
    @Transactional
    @Deprecated
    public Long createOwnedPngAsset(Long userId, byte[] pngBytes, String name) {
        if (userId == null) {
            throw new BusinessException(401, "未登录");
        }
        if (pngBytes == null || pngBytes.length == 0) {
            throw new BusinessException(400, "裁切结果为空");
        }
        String fileName = name != null && !name.isBlank() ? name : "matting-crop.png";
        if (!fileName.toLowerCase().endsWith(".png")) {
            fileName = fileName + ".png";
        }
        String path = fileStorageService.storeFromBytes(fileName, pngBytes, "image/png");
        Asset asset = new Asset();
        asset.setUserId(userId);
        asset.setName(fileName);
        asset.setType("image/png");
        asset.setUrl(path);
        asset.setSize((long) pngBytes.length);
        asset.setCreatedAt(LocalDateTime.now());
        asset.setUpdatedAt(LocalDateTime.now());
        assetMapper.insert(asset);
        return asset.getId();
    }

    /** 抠图框选裁切：按任务/区域写入工作流目录，不入 asset 表 */
    public String storeMattingCropPng(Long taskId, String regionId, byte[] pngBytes) {
        if (taskId == null) {
            throw new BusinessException(400, "任务 id 无效");
        }
        if (regionId == null || regionId.isBlank()) {
            throw new BusinessException(400, "区域 id 无效");
        }
        String safeRegionId = regionId.replaceAll("[^a-zA-Z0-9_-]", "_");
        String fileName = safeRegionId + ".png";
        String subdir = "matting/" + taskId;
        return fileStorageService.storeFromBytes(fileName, pngBytes, "image/png", subdir);
    }

    /** 工作流中间文件：仅写磁盘，不入 asset 表（非抠图裁切场景保留） */
    public String storeWorkflowPng(byte[] pngBytes, String name) {
        if (pngBytes == null || pngBytes.length == 0) {
            throw new BusinessException(400, "裁切结果为空");
        }
        String fileName = name != null && !name.isBlank() ? name : "matting-crop.png";
        if (!fileName.toLowerCase().endsWith(".png")) {
            fileName = fileName + ".png";
        }
        return fileStorageService.storeFromBytes(fileName, pngBytes, "image/png");
    }

    /** Java ↔ Python L3 拉取用的绝对 URL（含 /uploads/ 前缀） */
    public String buildPublicUrlFromStoredPath(String storedPath) {
        if (storedPath == null || storedPath.isBlank()) {
            throw new BusinessException(400, "素材路径无效");
        }
        if (storedPath.startsWith("http://") || storedPath.startsWith("https://")) {
            return storedPath;
        }
        return buildFullUrl(toUploadsWebPath(storedPath));
    }

    /** 前端 img / Vite proxy 用的相对路径 */
    public String resolveBrowserMediaUrl(String imageUrl, String storagePath, Long assetId, Long userId) {
        if (assetId != null && userId != null) {
            try {
                Asset asset = assetMapper.selectById(assetId);
                if (asset != null && asset.getUserId().equals(userId)) {
                    return toBrowserUploadsPath(asset.getUrl());
                }
            } catch (Exception ignored) {
                /* fall through */
            }
        }
        if (storagePath != null && !storagePath.isBlank()) {
            return toBrowserUploadsPath(storagePath);
        }
        if (imageUrl != null && !imageUrl.isBlank()) {
            if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
                return normalizeLocalhostToRelative(imageUrl);
            }
            return toBrowserUploadsPath(imageUrl);
        }
        return imageUrl;
    }

    public record ProviderImageRef(String sourceUrl, byte[] imageBytes) {}

    /** 供 Seedream / 视觉 API：公网 URL 直传，本地/内网则读盘转 base64 */
    public ProviderImageRef resolveReferenceImageForProvider(String url, Long userId) {
        if (url == null || url.isBlank()) {
            return new ProviderImageRef(null, null);
        }
        String trimmed = url.trim();
        if (isPublicHttpsUrl(trimmed)) {
            return new ProviderImageRef(trimmed, null);
        }
        byte[] bytes = readReferenceImageBytes(trimmed, userId);
        return new ProviderImageRef(trimmed, bytes);
    }

    private byte[] readReferenceImageBytes(String url, Long userId) {
        if (url.startsWith("/uploads/") || url.startsWith("uploads/")) {
            return readWorkflowImageBytes(url);
        }
        String localPath = extractLocalUploadsPath(url);
        if (localPath != null) {
            return readWorkflowImageBytes(localPath);
        }
        return downloadImageBytes(url);
    }

    private String extractLocalUploadsPath(String url) {
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            return null;
        }
        try {
            URI uri = URI.create(url);
            String host = uri.getHost();
            if (host == null || !isPrivateOrLocalHost(host)) {
                return null;
            }
            String path = uri.getPath();
            if (path != null && path.startsWith("/uploads/")) {
                return path;
            }
        } catch (Exception ignored) {
            /* ignore */
        }
        return null;
    }

    private boolean isPublicHttpsUrl(String url) {
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            return false;
        }
        try {
            URI uri = URI.create(url);
            String host = uri.getHost();
            if (host == null || host.isBlank()) {
                return false;
            }
            return !isPrivateOrLocalHost(host);
        } catch (Exception e) {
            return false;
        }
    }

    private boolean isPrivateOrLocalHost(String host) {
        if (host == null || host.isBlank()) {
            return true;
        }
        String h = host.toLowerCase();
        if (h.equals("localhost") || h.equals("127.0.0.1") || h.equals("::1") || h.equals("0.0.0.0")) {
            return true;
        }
        if (h.endsWith(".local")) {
            return true;
        }
        try {
            InetAddress addr = InetAddress.getByName(h);
            return addr.isLoopbackAddress() || addr.isSiteLocalAddress() || addr.isLinkLocalAddress();
        } catch (Exception e) {
            return h.indexOf('.') < 0;
        }
    }

    private String toUploadsWebPath(String storedPath) {
        if (storedPath.startsWith("/uploads/")) {
            return storedPath;
        }
        if (storedPath.startsWith("uploads/")) {
            return "/" + storedPath;
        }
        String relative = normalizeStoredPath(storedPath);
        return "/uploads/" + relative;
    }

    private String toBrowserUploadsPath(String storedPath) {
        if (storedPath.startsWith("http://") || storedPath.startsWith("https://")) {
            return normalizeLocalhostToRelative(storedPath);
        }
        return toUploadsWebPath(storedPath);
    }

    private String normalizeLocalhostToRelative(String url) {
        String base = appProperties.getPublicBaseUrl();
        if (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        if (url.startsWith(base + "/uploads/")) {
            return url.substring(base.length());
        }
        if (url.startsWith(base)) {
            String suffix = url.substring(base.length());
            if (suffix.startsWith("/uploads/")) {
                return suffix;
            }
        }
        try {
            URI uri = URI.create(url);
            String host = uri.getHost();
            if (host != null && isPrivateOrLocalHost(host)) {
                String path = uri.getPath();
                if (path != null && path.startsWith("/uploads/")) {
                    return path;
                }
            }
        } catch (Exception ignored) {
            /* keep original */
        }
        return url;
    }

    public byte[] readWorkflowImageBytes(String storedPath) {
        return readBytesFromStoredPath(normalizeStoredPath(storedPath));
    }

    /** 从外链下载图片字节（Matting 服务端裁切读图源） */
    public byte[] downloadImageBytes(String imageUrl) {
        return downloadBytesFromUrl(imageUrl);
    }

    /** 将 AI 提供商临时 URL 下载并写入 uploads/{subdir}，返回 /uploads/... 稳定路径 */
    public String persistProviderImage(String providerUrl, String subdir, String fileName) {
        if (providerUrl == null || providerUrl.isBlank()) {
            throw new BusinessException(400, "图片 URL 无效");
        }
        byte[] bytes = downloadImageBytes(providerUrl);
        String safeName = fileName != null && !fileName.isBlank() ? fileName : "provider-image";
        if (!safeName.toLowerCase().endsWith(".png")) {
            safeName = safeName + ".png";
        }
        safeName = safeName.replaceAll("[^a-zA-Z0-9_.-]", "_");
        return fileStorageService.storeFromBytes(safeName, bytes, "image/png", subdir);
    }

    /** workflow source / 候选图浏览器展示 URL */
    public String resolveWorkflowImageUrl(String imageUrl, String storagePath, Long assetId, Long userId) {
        return resolveBrowserMediaUrl(imageUrl, storagePath, assetId, userId);
    }

    private byte[] readBytesFromStoredPath(String storedUrl) {
        if (storedUrl == null || storedUrl.isBlank()) {
            throw new BusinessException(400, "素材路径无效");
        }
        String relative = normalizeStoredPath(storedUrl);
        Path file = Paths.get(uploadProperties.getDir()).resolve(relative);
        try {
            if (!Files.isRegularFile(file)) {
                throw new BusinessException(404, "素材文件不存在");
            }
            return Files.readAllBytes(file);
        } catch (BusinessException e) {
            throw e;
        } catch (IOException e) {
            log.error("读取素材文件失败 path={}", file, e);
            throw new BusinessException(500, "读取素材文件失败");
        }
    }

    private String normalizeStoredPath(String storedUrl) {
        if (storedUrl.startsWith("/uploads/")) {
            return storedUrl.substring("/uploads/".length());
        }
        if (storedUrl.startsWith("uploads/")) {
            return storedUrl.substring("uploads/".length());
        }
        return storedUrl.replaceFirst("^/", "");
    }

    /** 素材库只展示用户主动上传/保存的内容，排除抠图工作流中间文件 */
    private <T extends LambdaQueryWrapper<Asset>> T applyUserVisibleAssetFilter(T wrapper) {
        wrapper.and(w -> w.notLike(Asset::getName, "matting-crop-%")
                .notLike(Asset::getName, "matting-scheme-%"));
        return wrapper;
    }

    /**
     * 从外部 URL 下载并入库 — Matting 保存 / Ops 候选打标用
     */
    @Transactional
    public AssetVO importFromUrl(String imageUrl, String name, List<String> tagNames) {
        Long userId = LoginUserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(401, "未登录");
        }
        byte[] bytes = downloadBytesFromUrl(imageUrl);
        String fileName = name != null && !name.isBlank() ? name : "ops-import.png";
        if (!fileName.contains(".")) {
            fileName = fileName + ".png";
        }
        String path = fileStorageService.storeFromBytes(fileName, bytes, "image/png");

        Asset asset = new Asset();
        asset.setUserId(userId);
        asset.setName(fileName);
        asset.setType("image/png");
        asset.setUrl(path);
        asset.setSize((long) bytes.length);
        asset.setCreatedAt(LocalDateTime.now());
        asset.setUpdatedAt(LocalDateTime.now());
        assetMapper.insert(asset);

        if (tagNames != null && !tagNames.isEmpty()) {
            List<Long> tagIds = tagNames.stream().map(this::findOrCreateTagId).collect(Collectors.toList());
            AssetTagsUpdateRequest req = new AssetTagsUpdateRequest();
            req.setTagIds(tagIds);
            replaceTags(asset.getId(), req);
        }
        return toAssetVO(asset);
    }

    /** 从 uploads/ 本地路径读取并入库 — Campaign 配图上传保存用 */
    @Transactional
    public AssetVO importFromStoredPath(String storedPath, String name, List<String> tagNames) {
        Long userId = LoginUserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(401, "未登录");
        }
        byte[] bytes = readWorkflowImageBytes(storedPath);
        String fileName = name != null && !name.isBlank() ? name : "ops-import.png";
        if (!fileName.contains(".")) {
            fileName = fileName + ".png";
        }
        String path = fileStorageService.storeFromBytes(fileName, bytes, "image/png");

        Asset asset = new Asset();
        asset.setUserId(userId);
        asset.setName(fileName);
        asset.setType("image/png");
        asset.setUrl(path);
        asset.setSize((long) bytes.length);
        asset.setCreatedAt(LocalDateTime.now());
        asset.setUpdatedAt(LocalDateTime.now());
        assetMapper.insert(asset);

        if (tagNames != null && !tagNames.isEmpty()) {
            List<Long> tagIds = tagNames.stream().map(this::findOrCreateTagId).collect(Collectors.toList());
            AssetTagsUpdateRequest req = new AssetTagsUpdateRequest();
            req.setTagIds(tagIds);
            replaceTags(asset.getId(), req);
        }
        return toAssetVO(asset);
    }

    /** 从外链下载图片字节（不带 Authorization，避免 TOS 签名 URL 被 RestTemplate 破坏） */
    private byte[] downloadBytesFromUrl(String imageUrl) {
        String url = imageUrl != null ? imageUrl.trim() : "";
        if (url.startsWith("/uploads/") || url.startsWith("uploads/")) {
            return readWorkflowImageBytes(url);
        }
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            throw new BusinessException(400, "图片 URL 无效");
        }
        try {
            HttpClient client = HttpClient.newBuilder()
                    .followRedirects(HttpClient.Redirect.NORMAL)
                    .connectTimeout(Duration.ofSeconds(15))
                    .build();
            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(120))
                    .header("Accept", "image/*,*/*")
                    .header("User-Agent", "AICreativeWorkbench/1.0")
                    .GET()
                    .build();
            HttpResponse<byte[]> response = client.send(request, HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() >= 400) {
                log.warn("下载图片失败 status={} url={}", response.statusCode(), abbreviateUrl(url));
                throw new BusinessException(400, "下载图片失败: HTTP " + response.statusCode());
            }
            byte[] body = response.body();
            if (body == null || body.length == 0) {
                throw new BusinessException(400, "无法下载图片");
            }
            return body;
        } catch (BusinessException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BusinessException(400, "下载图片被中断");
        } catch (Exception e) {
            log.warn("下载图片异常 url={}", abbreviateUrl(url), e);
            throw new BusinessException(400, "下载图片失败: " + e.getMessage());
        }
    }

    private static String abbreviateUrl(String url) {
        return url.length() > 120 ? url.substring(0, 120) + "..." : url;
    }

    private Long findOrCreateTagId(String name) {
        Tag exist = tagMapper.selectOne(
                new LambdaQueryWrapper<Tag>().eq(Tag::getName, name).last("LIMIT 1")
        );
        if (exist != null) {
            return exist.getId();
        }
        Tag tag = new Tag();
        tag.setName(name);
        tag.setColor("#0D9488");
        tag.setCreatedAt(LocalDateTime.now());
        tag.setUpdatedAt(LocalDateTime.now());
        tagMapper.insert(tag);
        return tag.getId();
    }
}
