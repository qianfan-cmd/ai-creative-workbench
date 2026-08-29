package com.workbench.backendjava.service;

import com.workbench.backendjava.client.PythonAiClient;
import com.workbench.backendjava.common.BusinessException;
import com.workbench.backendjava.common.LoginUserContext;
import com.workbench.backendjava.vo.KnowledgeDocumentVO;
import com.workbench.backendjava.vo.KnowledgeUploadVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.Locale;
import java.util.List;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class KnowledgeService {

    private static final Set<String> ALLOWED_EXT = Set.of(".txt", ".md", ".markdown");
    private final PythonAiClient pythonAiClient;

    public KnowledgeUploadVO upload(MultipartFile file) {
        Long userId = LoginUserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(401, "未登录");
        }

        if (file == null || file.isEmpty()) {
            throw new BusinessException(400, "请选择文件");
        }

        String filename = file.getOriginalFilename();
        if (filename == null || filename.isBlank()) {
            throw new BusinessException(400, "文件名无效");
        }

        String ext = filename.contains(".")
                ? filename.substring(filename.lastIndexOf('.')).toLowerCase(Locale.ROOT)
                : "";

        if (!ALLOWED_EXT.contains(ext)) {
            throw new BusinessException(400, "不支持的文件类型");
        }

        log.info("知识库上传, userId={}, filename={}", userId, filename);

        return pythonAiClient.indexDocument(file);
    }

    /**
     * 文档库列表 — 从 Python/Chroma 聚合，刷新页面后仍可展示。
     */
    public List<KnowledgeDocumentVO> listDocuments() {
        Long userId = LoginUserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(401, "未登录");
        }
        return pythonAiClient.listDocuments();
    }
}
