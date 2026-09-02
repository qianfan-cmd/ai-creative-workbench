package com.workbench.backendjava.service;

import com.workbench.backendjava.common.PageResult;
import com.workbench.backendjava.dto.KnowledgeDocumentPatchRequest;
import com.workbench.backendjava.vo.KnowledgeDocumentContentVO;
import com.workbench.backendjava.vo.KnowledgeDocumentVO;
import com.workbench.backendjava.vo.KnowledgeUploadVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * 知识库文档上传与列表 — 委托 KnowledgeDocumentService。
 */
@Service
@RequiredArgsConstructor
public class KnowledgeService {

    private final KnowledgeDocumentService knowledgeDocumentService;

    public KnowledgeUploadVO upload(MultipartFile file) {
        return knowledgeDocumentService.uploadDocument(file);
    }

    public PageResult<KnowledgeDocumentVO> listDocumentsPage(long page, long size, String keyword, String sort) {
        return knowledgeDocumentService.listPage(page, size, keyword, sort);
    }

    public List<KnowledgeDocumentVO> listRecentDocuments(int limit) {
        return knowledgeDocumentService.listRecent(limit);
    }

    public KnowledgeDocumentVO patchDocument(Long id, KnowledgeDocumentPatchRequest request) {
        return knowledgeDocumentService.patchDocument(id, request);
    }

    public void deleteDocument(Long id) {
        knowledgeDocumentService.deleteDocument(id);
    }

    public KnowledgeDocumentContentVO getDocumentContent(Long id) {
        return knowledgeDocumentService.getContent(id);
    }

    public long countDocuments() {
        return knowledgeDocumentService.countForCurrentUser();
    }
}
