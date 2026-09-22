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

 * 知识库文档门面：Controller 入口层，薄委托 {@link KnowledgeDocumentService}。

 * 不含向量/Python 细节，便于 KnowledgeController 保持精简。

 */

@Service

@RequiredArgsConstructor

public class KnowledgeService {



    private final KnowledgeDocumentService knowledgeDocumentService;



    /** 单文件上传（legacy）；内部走批量接口，失败时抛 400。调用方：{@code POST /api/knowledge/upload}。 */

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



    /** 批量上传；调用方：{@code POST /api/knowledge/documents/upload}。 */

    public KnowledgeBatchUploadVO uploadDocumentsBatch(MultipartFile[] files) {

        return knowledgeDocumentService.uploadDocumentsBatch(files);

    }



    /** 文档库分页；调用方：Knowledge 文档列表页。 */

    public PageResult<KnowledgeDocumentVO> listDocumentsPage(long page, long size, String keyword, String sort) {

        return knowledgeDocumentService.listPage(page, size, keyword, sort);

    }



    /** 侧栏最近文档；调用方：Knowledge 问答页左栏。 */

    public List<KnowledgeDocumentVO> listRecentDocuments(int limit) {

        return knowledgeDocumentService.listRecent(limit);

    }



    /** 重命名文档（触发 reindex）；调用方：{@code PATCH /api/knowledge/documents/{id}}。 */

    public KnowledgeDocumentVO patchDocument(Long id, KnowledgeDocumentPatchRequest request) {

        return knowledgeDocumentService.patchDocument(id, request);

    }



    /** 删除单文档（MySQL + 磁盘 + Chroma）；调用方：{@code DELETE /api/knowledge/documents/{id}}。 */

    public void deleteDocument(Long id) {

        knowledgeDocumentService.deleteDocument(id);

    }



    /** 批量删除；调用方：{@code POST /api/knowledge/documents/batch-delete}。 */

    public KnowledgeBatchDeleteVO deleteDocumentsBatch(IdsBatchDeleteRequest request) {

        return knowledgeDocumentService.deleteDocumentsBatch(request);

    }



    /** 读取正文（文本直读，PDF/DOCX 经 Python parse）；调用方：编辑器页 GET content。 */

    public KnowledgeDocumentContentVO getDocumentContent(Long id) {

        return knowledgeDocumentService.getContent(id);

    }



    /** 保存编辑后正文并 reindex；调用方：{@code PUT /api/knowledge/documents/{id}/content}。 */

    public KnowledgeDocumentVO saveDocumentContent(Long id, String content) {

        return knowledgeDocumentService.saveContent(id, content);

    }



    /** 当前用户文档总数。 */

    public long countDocuments() {

        return knowledgeDocumentService.countForCurrentUser();

    }

}


