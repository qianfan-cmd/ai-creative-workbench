package com.workbench.backendjava.service;

import com.workbench.backendjava.common.BusinessException;
import com.workbench.backendjava.model.MattingConfig.ConfirmedSource;
import com.workbench.backendjava.model.MattingConfig.CropRegion;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

/** 抠图模块：按原图百分比在服务端裁切子图并入库 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MattingImageCropService {

    private final AssetService assetService;

    public static final class CropAssetResult {
        private final Long assetId;
        private final String publicUrl;

        public CropAssetResult(Long assetId, String publicUrl) {
            this.assetId = assetId;
            this.publicUrl = publicUrl;
        }

        public Long getAssetId() {
            return assetId;
        }

        public String getPublicUrl() {
            return publicUrl;
        }
    }

    /**
     * 从已确认来源整图按 0–100% 矩形裁切，写入 uploads 并返回 subAsset。
     */
    public CropAssetResult cropRegionFromSource(
            Long userId,
            ConfirmedSource source,
            CropRegion region,
            String fileName) {
        if (userId == null) {
            throw new BusinessException(401, "未登录");
        }
        if (region == null) {
            throw new BusinessException(400, "切割区域无效");
        }
        byte[] sourceBytes = loadSourceBytes(userId, source);
        byte[] cropped;
        try {
            cropped = cropBytesByPct(
                    sourceBytes,
                    region.getXPct(),
                    region.getYPct(),
                    region.getWPct(),
                    region.getHPct());
        } catch (IOException e) {
            log.error("裁切失败 regionId={}", region.getId(), e);
            throw new BusinessException(500, "裁切失败: " + e.getMessage());
        }
        Long assetId = assetService.createOwnedPngAsset(userId, cropped, fileName);
        String publicUrl = assetService.getPublicUrlForOwnedAsset(assetId, userId);
        return new CropAssetResult(assetId, publicUrl);
    }

    private byte[] loadSourceBytes(Long userId, ConfirmedSource source) {
        if (source == null) {
            throw new BusinessException(400, "来源整图不存在");
        }
        if (source.getSourceAssetId() != null) {
            try {
                return assetService.readOwnedAssetBytes(source.getSourceAssetId(), userId);
            } catch (BusinessException e) {
                if (source.getSourceImageUrl() == null || source.getSourceImageUrl().isBlank()) {
                    throw e;
                }
                log.warn("读取本地源图失败，回退外链 sourceAssetId={}", source.getSourceAssetId());
            }
        }
        if (source.getSourceImageUrl() != null && !source.getSourceImageUrl().isBlank()) {
            return assetService.downloadImageBytes(source.getSourceImageUrl());
        }
        throw new BusinessException(400, "源图不可用");
    }

    static byte[] cropBytesByPct(byte[] sourceBytes, Double xPct, Double yPct, Double wPct, Double hPct)
            throws IOException {
        if (sourceBytes == null || sourceBytes.length == 0) {
            throw new BusinessException(400, "源图数据为空");
        }
        double x = xPct != null ? xPct : 0;
        double y = yPct != null ? yPct : 0;
        double w = wPct != null ? wPct : 0;
        double h = hPct != null ? hPct : 0;
        if (w <= 0 || h <= 0) {
            throw new BusinessException(400, "切割区域尺寸无效");
        }

        BufferedImage image = ImageIO.read(new ByteArrayInputStream(sourceBytes));
        if (image == null) {
            throw new BusinessException(400, "无法解析源图");
        }
        int nw = image.getWidth();
        int nh = image.getHeight();
        if (nw <= 0 || nh <= 0) {
            throw new BusinessException(400, "源图尺寸无效");
        }

        int sx = (int) Math.round(x / 100.0 * nw);
        int sy = (int) Math.round(y / 100.0 * nh);
        int sw = Math.max(1, (int) Math.round(w / 100.0 * nw));
        int sh = Math.max(1, (int) Math.round(h / 100.0 * nh));

        sx = Math.max(0, Math.min(sx, nw - 1));
        sy = Math.max(0, Math.min(sy, nh - 1));
        sw = Math.max(1, Math.min(sw, nw - sx));
        sh = Math.max(1, Math.min(sh, nh - sy));

        BufferedImage sub = image.getSubimage(sx, sy, sw, sh);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        if (!ImageIO.write(sub, "png", out)) {
            throw new BusinessException(500, "裁切 PNG 编码失败");
        }
        return out.toByteArray();
    }
}
