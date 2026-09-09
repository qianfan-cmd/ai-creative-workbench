package com.workbench.backendjava.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.workbench.backendjava.client.PythonAiClient;
import com.workbench.backendjava.common.BusinessException;
import com.workbench.backendjava.common.LoginUserContext;
import com.workbench.backendjava.common.PageResult;
import com.workbench.backendjava.config.UploadProperties;
import com.workbench.backendjava.dto.IdsBatchDeleteRequest;
import com.workbench.backendjava.dto.KnowledgeDocumentPatchRequest;
import com.workbench.backendjava.entity.KnowledgeDocument;
import com.workbench.backendjava.mapper.KnowledgeDocumentMapper;
import com.workbench.backendjava.vo.KnowledgeBatchDeleteVO;
import com.workbench.backendjava.vo.KnowledgeBatchUploadVO;
import com.workbench.backendjava.vo.KnowledgeDeleteFailureVO;
import com.workbench.backendjava.vo.KnowledgeDocumentContentVO;
import com.workbench.backendjava.vo.KnowledgeDocumentVO;
import com.workbench.backendjava.vo.KnowledgeUploadFailureVO;
import com.workbench.backendjava.vo.KnowledgeReindexAllVO;
import com.workbench.backendjava.vo.KnowledgeReindexFailureVO;
import com.workbench.backendjava.vo.KnowledgeUploadVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class KnowledgeDocumentService {

    private static final Set<String> ALLOWED_EXT = Set.of(".txt", ".md", ".markdown", ".pdf", ".docx");
    private static final Set<String> BINARY_EXT = Set.of(".pdf", ".docx");
    private static final int MAX_BATCH_UPLOAD = 20;
    private static final int MAX_BATCH_DELETE = 100;
    private static final int BATCH_UPLOAD_CONCURRENCY = 2;
    private static final ExecutorService BATCH_UPLOAD_EXECUTOR =
            Executors.newFixedThreadPool(BATCH_UPLOAD_CONCURRENCY);
    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private final KnowledgeDocumentMapper documentMapper;
    private final PythonAiClient pythonAiClient;
    private final UploadProperties uploadProperties;
    private final ObjectProvider<KnowledgeDocumentService> selfProvider;
    private final KnowledgeDocumentTagService documentTagService;

    public KnowledgeBatchUploadVO uploadDocumentsBatch(MultipartFile[] files) {
        if (files == null || files.length == 0) {
            throw new BusinessException(400, "请选择至少一个文件");
        }
        if (files.length > MAX_BATCH_UPLOAD) {
            throw new BusinessException(400, "单次最多上传 " + MAX_BATCH_UPLOAD + " 个文件");
        }

        Long userId = requireUserId();
        List<KnowledgeUploadVO> succeeded = Collections.synchronizedList(new ArrayList<>());
        List<KnowledgeUploadFailureVO> failed = Collections.synchronizedList(new ArrayList<>());

        List<CompletableFuture<Void>> futures = new ArrayList<>(files.length);
        for (MultipartFile file : files) {
            futures.add(CompletableFuture.runAsync(() -> {
                LoginUserContext.setUserId(userId);
                String filename = resolveFilename(file);
                try {
                    succeeded.add(selfProvider.getObject().uploadDocument(file));
                } catch (BusinessException e) {
                    failed.add(failureOf(filename, e.getMessage()));
                } catch (RuntimeException e) {
                    log.error("批量上传失败 filename={}", filename, e);
                    failed.add(failureOf(filename, e.getMessage() != null ? e.getMessage() : "上传失败"));
                } finally {
                    LoginUserContext.clear();
                }
            }, BATCH_UPLOAD_EXECUTOR));
        }
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();

        KnowledgeBatchUploadVO result = new KnowledgeBatchUploadVO();
        result.setTotal(files.length);
        result.getSucceeded().addAll(succeeded);
        result.getFailed().addAll(failed);

        log.info("知识库批量上传 total={} succeeded={} failed={}",
                result.getTotal(), result.getSucceeded().size(), result.getFailed().size());
        return result;
    }

    public KnowledgeBatchDeleteVO deleteDocumentsBatch(IdsBatchDeleteRequest request) {
        if (request.getIds() == null || request.getIds().isEmpty()) {
            throw new BusinessException(400, "请选择至少一条记录");
        }
        if (request.getIds().size() > MAX_BATCH_DELETE) {
            throw new BusinessException(400, "单次最多删除 " + MAX_BATCH_DELETE + " 条记录");
        }

        KnowledgeBatchDeleteVO result = new KnowledgeBatchDeleteVO();
        result.setTotal(request.getIds().size());

        for (Long id : request.getIds()) {
            try {
                deleteDocument(id);
                result.getDeletedIds().add(id);
            } catch (BusinessException e) {
                result.getFailures().add(deleteFailureOf(id, e.getMessage()));
            } catch (RuntimeException e) {
                log.error("批量删除失败 id={}", id, e);
                result.getFailures().add(deleteFailureOf(id, e.getMessage() != null ? e.getMessage() : "删除失败"));
            }
        }

        log.info("知识库批量删除 total={} deleted={} failed={}",
                result.getTotal(), result.getDeletedIds().size(), result.getFailures().size());
        return result;
    }

    @Transactional
    public KnowledgeUploadVO uploadDocument(MultipartFile file) {
        Long userId = requireUserId();
        validateUploadFile(file);

        String filename = file.getOriginalFilename().trim();
        String ext = extensionOf(filename);
        String fileType = mimeOf(ext);
        byte[] bytes = readBytes(file);

        KnowledgeDocument doc = new KnowledgeDocument();
        doc.setUserId(userId);
        doc.setFilename(filename);
        doc.setFileType(fileType);
        doc.setFileSize((long) bytes.length);
        doc.setCharCount(0);
        doc.setChunkCount(0);
        doc.setChromaSource(filename);
        doc.setCreatedAt(LocalDateTime.now());
        doc.setUpdatedAt(LocalDateTime.now());
        documentMapper.insert(doc);

        String storedPath = storeKnowledgeFile(userId, doc.getId(), filename, bytes);
        doc.setStoredPath(storedPath);
        documentMapper.updateById(doc);

        try {
            KnowledgeUploadVO indexed = pythonAiClient.indexDocument(bytes, filename, doc.getId(), userId);
            doc.setCharCount(indexed.getCharCount());
            doc.setChunkCount(indexed.getChunkCount());
            doc.setUpdatedAt(LocalDateTime.now());
            documentMapper.updateById(doc);
            if (indexed.getSuggestedTags() != null && !indexed.getSuggestedTags().isEmpty()) {
                documentTagService.applyAiSuggestedTags(doc.getId(), indexed.getSuggestedTags());
            }
            return indexed;
        } catch (RuntimeException e) {
            documentMapper.deleteById(doc.getId());
            deleteStoredFile(storedPath);
            throw e;
        }
    }

    public PageResult<KnowledgeDocumentVO> listPage(long page, long size, String keyword, String sort) {
        Long userId = requireUserId();

        if (page < 1) page = 1;
        if (size < 1) size = 10;
        if (size > 100) size = 100;

        LambdaQueryWrapper<KnowledgeDocument> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(KnowledgeDocument::getUserId, userId);
        if (keyword != null && !keyword.isBlank()) {
            wrapper.like(KnowledgeDocument::getFilename, keyword.trim());
        }
        if ("asc".equalsIgnoreCase(sort != null ? sort.trim() : "")) {
            wrapper.orderByAsc(KnowledgeDocument::getCreatedAt);
        } else {
            wrapper.orderByDesc(KnowledgeDocument::getCreatedAt);
        }

        Page<KnowledgeDocument> result = documentMapper.selectPage(new Page<>(page, size), wrapper);
        List<KnowledgeDocumentVO> records = result.getRecords().stream()
                .map(this::toVO)
                .collect(Collectors.toList());
        attachTags(records);
        return PageResult.of(records, result.getTotal(), result.getCurrent(), result.getSize());
    }

    public List<KnowledgeDocumentVO> listRecent(int limit) {
        Long userId = requireUserId();

        if (limit < 1) limit = 50;
        if (limit > 100) limit = 100;

        LambdaQueryWrapper<KnowledgeDocument> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(KnowledgeDocument::getUserId, userId)
                .orderByDesc(KnowledgeDocument::getCreatedAt)
                .last("LIMIT " + limit);

        List<KnowledgeDocumentVO> list = documentMapper.selectList(wrapper).stream()
                .map(this::toVO)
                .collect(Collectors.toList());
        attachTags(list);
        return list;
    }

    @Transactional
    public void reindexDocumentById(Long id) {
        reindexDocumentById(id, requireUserId());
    }

    @Transactional
    public void reindexDocumentById(Long id, Long userId) {
        KnowledgeDocument doc = getOwnedDocument(id, userId);
        reindexDocumentInternal(doc);
    }

    private void reindexDocumentInternal(KnowledgeDocument doc) {
        if (doc.getStoredPath() == null || doc.getStoredPath().isBlank()) {
            throw new BusinessException(400, "该文档无原文件，无法 re-index");
        }
        byte[] bytes = readStoredBytes(doc.getStoredPath());
        Long userId = doc.getUserId();
        KnowledgeUploadVO indexed = pythonAiClient.indexDocument(
                bytes, doc.getFilename(), doc.getId(), userId
        );
        doc.setCharCount(indexed.getCharCount());
        doc.setChunkCount(indexed.getChunkCount());
        doc.setUpdatedAt(LocalDateTime.now());
        documentMapper.updateById(doc);
        if (indexed.getSuggestedTags() != null && !indexed.getSuggestedTags().isEmpty()) {
            documentTagService.applyAiSuggestedTags(doc.getId(), indexed.getSuggestedTags());
        }
    }

    /** Admin：全库重建向量（embedding 策略升级后执行一次） */
    public KnowledgeReindexAllVO reindexAllDocumentsAdmin() {
        LoginUserContext.requireAdmin();
        List<KnowledgeDocument> docs = documentMapper.selectList(new LambdaQueryWrapper<>());
        KnowledgeReindexAllVO result = new KnowledgeReindexAllVO();
        result.setTotal(docs.size());

        for (KnowledgeDocument doc : docs) {
            try {
                if (doc.getStoredPath() == null || doc.getStoredPath().isBlank()) {
                    throw new BusinessException(400, "无原文件");
                }
                reindexDocumentInternal(doc);
                result.setSucceeded(result.getSucceeded() + 1);
            } catch (Exception e) {
                KnowledgeReindexFailureVO failure = new KnowledgeReindexFailureVO();
                failure.setId(doc.getId());
                failure.setFilename(doc.getFilename());
                failure.setReason(e.getMessage() != null ? e.getMessage() : "reindex failed");
                result.getFailed().add(failure);
                log.warn("admin reindex-all failed docId={} filename={}: {}", doc.getId(), doc.getFilename(), e.getMessage());
            }
        }
        return result;
    }

    @Transactional
    public KnowledgeDocumentVO patchDocument(Long id, KnowledgeDocumentPatchRequest request) {
        Long userId = requireUserId();
        KnowledgeDocument doc = getOwnedDocument(id, userId);

        String newFilename = request.getFilename() != null ? request.getFilename().trim() : "";
        if (newFilename.isBlank()) {
            throw new BusinessException(400, "文件名不能为空");
        }
        if (newFilename.equals(doc.getFilename())) {
            return toVO(doc);
        }
        validateFilename(newFilename);

        if (doc.getStoredPath() == null || doc.getStoredPath().isBlank()) {
            throw new BusinessException(400, "该文档无原文件，请重新上传后再重命名");
        }

        byte[] bytes = readStoredBytes(doc.getStoredPath());
        reindexDocument(doc, userId, newFilename, bytes);
        return toVO(doc);
    }

    @Transactional
    public KnowledgeDocumentVO saveContent(Long id, String content) {
        Long userId = requireUserId();
        KnowledgeDocument doc = getOwnedDocument(id, userId);

        if (isBinaryExtension(extensionOf(doc.getFilename()))) {
            throw new BusinessException(400, "PDF/DOCX 不支持在线编辑，请重新上传");
        }

        if (doc.getStoredPath() == null || doc.getStoredPath().isBlank()) {
            throw new BusinessException(400, "该文档无原文件，请重新上传后再编辑");
        }
        if (content == null) {
            throw new BusinessException(400, "内容不能为空");
        }

        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > uploadProperties.getMaxSize()) {
            throw new BusinessException(400, "文件不能大于50M");
        }

        reindexDocument(doc, userId, doc.getFilename(), bytes);
        return toVO(doc);
    }

    private void reindexDocument(KnowledgeDocument doc, Long userId, String filename, byte[] bytes) {
        String oldSource = doc.getChromaSource();
        if (oldSource != null && !oldSource.isBlank()) {
            pythonAiClient.deleteDocument(oldSource, doc.getId(), 0);
        }

        String oldStoredPath = doc.getStoredPath();
        String newStoredPath = storeKnowledgeFile(userId, doc.getId(), filename, bytes);
        if (oldStoredPath != null && !oldStoredPath.equals(newStoredPath)) {
            deleteStoredFile(oldStoredPath);
        } 

        KnowledgeUploadVO indexed = pythonAiClient.indexDocument(bytes, filename, doc.getId(), userId);

        doc.setFilename(filename);
        doc.setChromaSource(filename);
        doc.setStoredPath(newStoredPath);
        doc.setFileType(mimeOf(extensionOf(filename)));
        doc.setFileSize((long) bytes.length);
        doc.setCharCount(indexed.getCharCount());
        doc.setChunkCount(indexed.getChunkCount());
        doc.setUpdatedAt(LocalDateTime.now());
        documentMapper.updateById(doc);
    }

    @Transactional
    public void deleteDocument(Long id) {
        Long userId = requireUserId();
        KnowledgeDocument doc = getOwnedDocument(id, userId);

        int chunkCount = doc.getChunkCount() != null ? doc.getChunkCount() : 0;
        String source = doc.getChromaSource();
        boolean hasVectors = chunkCount > 0
                || (source != null && !source.isBlank());

        if (hasVectors) {
            pythonAiClient.deleteDocument(source, doc.getId(), chunkCount);
        }
        if (doc.getStoredPath() != null && !doc.getStoredPath().isBlank()) {
            deleteStoredFile(doc.getStoredPath());
        }
        documentMapper.deleteById(id);
    }

    public KnowledgeDocumentContentVO getContent(Long id) {
        Long userId = requireUserId();
        KnowledgeDocument doc = getOwnedDocument(id, userId);
        if (doc.getStoredPath() == null || doc.getStoredPath().isBlank()) {
            throw new BusinessException(404, "该文档无原文件内容");
        }
        byte[] bytes = readStoredBytes(doc.getStoredPath());
        KnowledgeDocumentContentVO vo = new KnowledgeDocumentContentVO();
        vo.setId(doc.getId());
        vo.setFilename(doc.getFilename());
        vo.setFileType(doc.getFileType());
        if (isBinaryExtension(extensionOf(doc.getFilename()))) {
            PythonAiClient.PythonParseResult parsed = pythonAiClient.parseDocument(bytes, doc.getFilename());
            vo.setContent(parsed.getContent());
        } else {
            vo.setContent(new String(bytes, StandardCharsets.UTF_8));
        }
        return vo;
    }

    /** 从 Chroma 回填 MySQL 中缺失的文档（幂等） */
    public void syncFromChromaIfNeeded(Long userId) {
        List<KnowledgeDocumentVO> chromaDocs = pythonAiClient.listDocuments();
        if (chromaDocs.isEmpty()) {
            return;
        }

        List<String> existingSources = documentMapper.selectList(
                new LambdaQueryWrapper<KnowledgeDocument>()
                        .select(KnowledgeDocument::getChromaSource)
                        .eq(KnowledgeDocument::getUserId, userId)
        ).stream()
                .map(KnowledgeDocument::getChromaSource)
                .filter(s -> s != null && !s.isBlank())
                .distinct()
                .collect(Collectors.toList());

        LocalDateTime now = LocalDateTime.now();
        for (KnowledgeDocumentVO item : chromaDocs) {
            String source = item.getFilename();
            if (source == null || source.isBlank() || existingSources.contains(source)) {
                continue;
            }
            KnowledgeDocument doc = new KnowledgeDocument();
            doc.setUserId(userId);
            doc.setFilename(source);
            doc.setFileType(mimeOf(extensionOf(source)));
            doc.setFileSize(0L);
            doc.setCharCount(0);
            doc.setChunkCount(item.getChunkCount() != null ? item.getChunkCount() : 0);
            doc.setChromaSource(source);
            doc.setCreatedAt(now);
            doc.setUpdatedAt(now);
            documentMapper.insert(doc);
            existingSources.add(source);
            log.info("Chroma 文档回填 MySQL: userId={}, source={}", userId, source);
        }
    }

    private KnowledgeDocument getOwnedDocument(Long id, Long userId) {
        KnowledgeDocument doc = documentMapper.selectById(id);
        if (doc == null || !userId.equals(doc.getUserId())) {
            throw new BusinessException(404, "文档不存在");
        }
        return doc;
    }

    private void attachTags(List<KnowledgeDocumentVO> records) {
        if (records == null || records.isEmpty()) {
            return;
        }
        List<Long> ids = records.stream().map(KnowledgeDocumentVO::getId).collect(Collectors.toList());
        var tagMap = documentTagService.listTagsForDocuments(ids);
        for (KnowledgeDocumentVO vo : records) {
            vo.setTags(tagMap.getOrDefault(vo.getId(), List.of()));
        }
    }

    private KnowledgeDocumentVO toVO(KnowledgeDocument doc) {
        KnowledgeDocumentVO vo = new KnowledgeDocumentVO();
        vo.setId(doc.getId());
        vo.setFilename(doc.getFilename());
        vo.setFileType(doc.getFileType());
        vo.setFileSize(doc.getFileSize());
        vo.setCharCount(doc.getCharCount());
        vo.setChunkCount(doc.getChunkCount());
        vo.setHasOriginalFile(doc.getStoredPath() != null && !doc.getStoredPath().isBlank());
        if (doc.getCreatedAt() != null) {
            vo.setCreatedAt(doc.getCreatedAt().format(ISO));
        }
        return vo;
    }

    private static String resolveFilename(MultipartFile file) {
        if (file == null || file.getOriginalFilename() == null || file.getOriginalFilename().isBlank()) {
            return "unknown";
        }
        return file.getOriginalFilename().trim();
    }

    private static KnowledgeUploadFailureVO failureOf(String filename, String reason) {
        KnowledgeUploadFailureVO vo = new KnowledgeUploadFailureVO();
        vo.setFilename(filename);
        vo.setReason(reason);
        return vo;
    }

    private static KnowledgeDeleteFailureVO deleteFailureOf(Long id, String reason) {
        KnowledgeDeleteFailureVO vo = new KnowledgeDeleteFailureVO();
        vo.setId(id);
        vo.setReason(reason);
        return vo;
    }

    private void validateUploadFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(400, "请选择文件");
        }
        String filename = file.getOriginalFilename();
        if (filename == null || filename.isBlank()) {
            throw new BusinessException(400, "文件名无效");
        }
        validateFilename(filename.trim());
        if (file.getSize() > uploadProperties.getMaxSize()) {
            throw new BusinessException(400, "文件不能大于50M");
        }
    }

    private void validateFilename(String filename) {
        String ext = extensionOf(filename);
        if (!ALLOWED_EXT.contains(ext)) {
            throw new BusinessException(400, "不支持的文件类型，支持 .txt / .md / .markdown / .pdf / .docx");
        }
    }

    private boolean isBinaryExtension(String ext) {
        return BINARY_EXT.contains(ext);
    }

    private String extensionOf(String filename) {
        return filename.contains(".")
                ? filename.substring(filename.lastIndexOf('.')).toLowerCase(Locale.ROOT)
                : "";
    }

    private String mimeOf(String ext) {
        return switch (ext) {
            case ".md", ".markdown" -> "text/markdown";
            case ".txt" -> "text/plain";
            case ".pdf" -> "application/pdf";
            case ".docx" -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            default -> "application/octet-stream";
        };
    }

    private byte[] readBytes(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (IOException e) {
            throw new BusinessException(500, "读取上传文件失败");
        }
    }

    private String storeKnowledgeFile(Long userId, Long docId, String filename, byte[] bytes) {
        String safeName = sanitizeFilename(filename);
        String relative = "knowledge/" + userId + "/" + docId + "/" + safeName;
        Path target = Paths.get(uploadProperties.getDir()).resolve(relative);
        try {
            Files.createDirectories(target.getParent());
            Files.write(target, bytes);
            return relative.replace("\\", "/");
        } catch (IOException e) {
            log.error("保存知识库原文件失败 path={}", relative, e);
            throw new BusinessException(500, "文件保存失败");
        }
    }

    private byte[] readStoredBytes(String storedPath) {
        Path file = Paths.get(uploadProperties.getDir()).resolve(normalizeStoredPath(storedPath));
        try {
            if (!Files.exists(file)) {
                throw new BusinessException(404, "原文件不存在");
            }
            return Files.readAllBytes(file);
        } catch (IOException e) {
            throw new BusinessException(500, "读取原文件失败");
        }
    }

    private void deleteStoredFile(String storedPath) {
        if (storedPath == null || storedPath.isBlank()) {
            return;
        }
        try {
            Path file = Paths.get(uploadProperties.getDir()).resolve(normalizeStoredPath(storedPath));
            Files.deleteIfExists(file);
            Path parent = file.getParent();
            if (parent != null && Files.isDirectory(parent)) {
                try (var stream = Files.list(parent)) {
                    if (stream.findAny().isEmpty()) {
                        Files.deleteIfExists(parent);
                    }
                }
            }
        } catch (IOException e) {
            log.warn("删除知识库原文件失败 path={}", storedPath, e);
        }
    }

    private static String normalizeStoredPath(String storedPath) {
        String p = storedPath.replace("\\", "/");
        if (p.startsWith("/uploads/")) {
            return p.substring("/uploads/".length());
        }
        if (p.startsWith("uploads/")) {
            return p.substring("uploads/".length());
        }
        return p;
    }

    private static String sanitizeFilename(String filename) {
        String name = filename.replace("\\", "/");
        int slash = name.lastIndexOf('/');
        if (slash >= 0) {
            name = name.substring(slash + 1);
        }
        return name.replaceAll("[^a-zA-Z0-9._\\-\\u4e00-\\u9fff]", "_");
    }

    public long countForCurrentUser() {
        Long userId = requireUserId();
        return documentMapper.selectCount(
                new LambdaQueryWrapper<KnowledgeDocument>().eq(KnowledgeDocument::getUserId, userId)
        );
    }

    private Long requireUserId() {
        Long userId = LoginUserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(401, "未登录");
        }
        return userId;
    }
}
