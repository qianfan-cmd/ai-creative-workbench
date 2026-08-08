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
        validate(file);

        String ext = getExtension(file.getOriginalFilename());
        String uuid = UUID.randomUUID().toString().replace("-", "");
        String storedName = uuid + "." + ext;// 生成全球唯一ID，给文件起一个随机的名字

        Path dir = Paths.get(uploadProperties.getDir());// 把路径转成Path对象
        try {
            Files.createDirectories(dir);// 创建目录
            Path target = dir.resolve(storedName);// 把目录和文件名拼接成完整的路径
            /**
             * 核心：把上传内容写到磁盘。
             *
             * MultipartFile.transferTo(File dest)：Spring 提供，把内存/临时文件里的内容写到目标文件
             * target.toFile()：把 Path 转成老版 File（因为 transferTo 要 File 参数）
             * 执行后，磁盘上会有：项目根目录/uploads/随机名.png
             */
            file.transferTo(target.toFile());
            log.info("文件保存成功，storedName={}, size={}", storedName, file.getSize());
            return "/uploads/" + storedName;

        } catch(IOException e) {
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
}
