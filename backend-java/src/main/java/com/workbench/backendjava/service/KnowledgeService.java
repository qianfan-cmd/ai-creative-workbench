package com.workbench.backendjava.service;

import com.workbench.backendjava.common.BusinessException;
import com.workbench.backendjava.common.PageResult;
import com.workbench.backendjava.dto.IdsBatchDeleteRequest;
import com.workbench.backendjava.dto.KnowledgeDocumentPatchRequest;
import com.workbench.backendjava.vo.KnowledgeBatchDeleteVO;
import com.workbench.backendjava.vo.KnowledgeBatchUploadVO;
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
        KnowledgeBatchUploadVO batch = knowledgeDocumentService.uploadDocumentsBatch(new MultipartFile[]{file});
        if (batch.getSucceeded().isEmpty()) {
            String reason = batch.getFailed().isEmpty()
                    ? "上传失败"
                    : batch.getFailed().get(0).getReason();
            throw new BusinessException(400, reason);
        }
        return batch.getSucceeded().get(0);
    }

    public KnowledgeBatchUploadVO uploadDocumentsBatch(MultipartFile[] files) {
        return knowledgeDocumentService.uploadDocumentsBatch(files);
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

    public KnowledgeBatchDeleteVO deleteDocumentsBatch(IdsBatchDeleteRequest request) {
        return knowledgeDocumentService.deleteDocumentsBatch(request);
    }

    public KnowledgeDocumentContentVO getDocumentContent(Long id) {
        return knowledgeDocumentService.getContent(id);
    }

    public KnowledgeDocumentVO saveDocumentContent(Long id, String content) {
        return knowledgeDocumentService.saveContent(id, content);
    }

    public long countDocuments() {
        return knowledgeDocumentService.countForCurrentUser();
    }
}
