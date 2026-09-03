package com.workbench.backendjava.service;

import com.workbench.backendjava.common.BusinessException;
import com.workbench.backendjava.config.UploadProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class FileStorageService {

    private final UploadProperties uploadProperties;

    /**
     * 校验-》写盘-》返回访问路径
     */
    public String store(MultipartFile file) {
        return store(file, null);
    }

    /**
     * 写入 uploads/ 或 uploads/{subdir}/，返回 /uploads/... 访问路径。
     */
    public String store(MultipartFile file, String subdir) {
        validate(file);

        String ext = getExtension(file.getOriginalFilename());
        String uuid = UUID.randomUUID().toString().replace("-", "");
        String storedName;
        if (subdir != null && !subdir.isBlank()) {
            String safeSubdir = subdir.replace("\\", "/").replaceAll("^/+|/+$", "");
            storedName = safeSubdir + "/" + uuid + "." + ext;
        } else {
            storedName = uuid + "." + ext;
        }

        Path dir = Paths.get(uploadProperties.getDir());
        try {
            Path target = dir.resolve(storedName);
            Files.createDirectories(target.getParent());
            file.transferTo(target.toFile());
            log.info("文件保存成功，storedName={}, size={}", storedName, file.getSize());
            return "/uploads/" + storedName.replace("\\", "/");
        } catch (IOException e) {
            log.error("文件保存失败", e);
            throw new BusinessException(500, "文件保存失败");
        }
    }

    /**
     * 校验文件
     * 空文件、超大小、扩展名白名单
     */
    private void validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(400, "文件不能为空");
        }

        if (file.getSize() > uploadProperties.getMaxSize()) {
            throw new BusinessException(400, "文件不能大于50M");
        }

        String ext = getExtension(file.getOriginalFilename()).toLowerCase();// 获取type
        if (!uploadProperties.getAllowedExtensions().contains(ext)) {
            throw new BusinessException(400, "不支持文件类型");
        }
    }

    /**
     * 获取扩展名
     * @param filename
     * @return
     */
    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) {
            throw new BusinessException(400, "文件名无效");
        }
        return filename.substring(filename.lastIndexOf(".") + 1);
    }

    /**
     * 外部 URL 下载的字节写入磁盘 — Ops 候选图入库用
     */
    public String storeFromBytes(String originalName, byte[] bytes, String contentType) {
        return storeFromBytes(originalName, bytes, contentType, null);
    }

    /**
     * @param subdir 可选子目录（相对 uploads/），如 matting/42 — 工作流中间文件用
     */
    public String storeFromBytes(String originalName, byte[] bytes, String contentType, String subdir) {
        if (bytes == null || bytes.length == 0) {
            throw new BusinessException(400, "文件不能为空");
        }
        if (bytes.length > uploadProperties.getMaxSize()) {
            throw new BusinessException(400, "文件不能大于50M");
        }
        String ext = getExtension(originalName).toLowerCase();
        if (!uploadProperties.getAllowedExtensions().contains(ext)) {
            throw new BusinessException(400, "不支持文件类型");
        }
        String storedName;
        if (subdir != null && !subdir.isBlank()) {
            String safeSubdir = subdir.replace("\\", "/").replaceAll("^/+|/+$", "");
            String baseName = originalName != null && originalName.contains(".")
                    ? originalName.substring(0, originalName.lastIndexOf('.'))
                    : "file";
            storedName = safeSubdir + "/" + baseName + "." + ext;
        } else {
            String uuid = UUID.randomUUID().toString().replace("-", "");
            storedName = uuid + "." + ext;
        }
        Path dir = Paths.get(uploadProperties.getDir());
        try {
            Path target = dir.resolve(storedName);
            Files.createDirectories(target.getParent());
            Files.write(target, bytes);
            log.info("字节流保存成功, storedName={}, size={}", storedName, bytes.length);
            return "/uploads/" + storedName.replace("\\", "/");
        } catch (IOException e) {
            log.error("字节流保存失败", e);
            throw new BusinessException(500, "文件保存失败");
        }
    }
}
