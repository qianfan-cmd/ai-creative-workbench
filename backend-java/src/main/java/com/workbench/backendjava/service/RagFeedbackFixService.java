package com.workbench.backendjava.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.workbench.backendjava.client.PythonAiClient;
import com.workbench.backendjava.dto.RagFeedbackFixRequest;
import com.workbench.backendjava.entity.KnowledgeDocument;
import com.workbench.backendjava.entity.KnowledgeTurn;
import com.workbench.backendjava.mapper.KnowledgeDocumentMapper;
import com.workbench.backendjava.mapper.KnowledgeTurnMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class RagFeedbackFixService {

    private final PythonAiClient pythonAiClient;
    private final KnowledgeTurnMapper turnMapper;
    private final KnowledgeDocumentMapper documentMapper;
    private final KnowledgeDocumentService knowledgeDocumentService;
    private final KnowledgeDocumentTagService documentTagService;
    private final RagChunkSignalService chunkSignalService;
    private final RagSourceSignalService sourceSignalService;
    private final RagFeedbackActionService actionService;
    private final ObjectMapper objectMapper;

    @Async
    public void handleRagDownvoteAsync(
            Long feedbackId,
            Long turnId,
            Long userId,
            String reason,
            String reasonDetail
    ) {
        try {
            KnowledgeTurn turn = turnMapper.selectById(turnId);
            if (turn == null) {
                return;
            }
            RagFeedbackFixRequest req = new RagFeedbackFixRequest();
            req.setFeedbackId(feedbackId);
            req.setTurnId(turnId);
            req.setUserId(userId);
            req.setQuestion(turn.getQuestion());
            req.setAnswer(turn.getAnswer());
            req.setReason(reason);
            req.setReasonDetail(reasonDetail);
            if (turn.getReferencesJson() != null && !turn.getReferencesJson().isBlank()) {
                req.setReferences(objectMapper.readValue(
                        turn.getReferencesJson(),
                        new TypeReference<List<Map<String, Object>>>() {}
                ));
            }

            List<Map<String, Object>> actions = pythonAiClient.ragFeedbackFix(req);
            applyActionsLocally(feedbackId, turnId, userId, actions);
        } catch (Exception e) {
            log.error("RAG feedback auto-fix failed feedbackId={} turnId={}", feedbackId, turnId, e);
            actionService.logAction(feedbackId, turnId, null, "triage", e.getMessage(), "failed");
        }
    }

    private void applyActionsLocally(
            Long feedbackId,
            Long turnId,
            Long userId,
            List<Map<String, Object>> actions
    ) {
        if (actions == null) {
            return;
        }
        for (Map<String, Object> action : actions) {
            String type = String.valueOf(action.get("action_type"));
            String detail = action.get("detail") != null ? String.valueOf(action.get("detail")) : null;
            Integer step = action.get("triage_step") instanceof Number n ? n.intValue() : null;
            String status = action.get("status") != null ? String.valueOf(action.get("status")) : "success";
            actionService.logAction(feedbackId, turnId, step, type, detail, status);

            if ("penalize".equals(type)) {
                String chunkId = String.valueOf(action.get("chunk_id"));
                String source = action.get("source") != null ? String.valueOf(action.get("source")) : null;
                chunkSignalService.addPenalty(chunkId, source, 1);
            } else if ("boost".equals(type)) {
                String chunkId = String.valueOf(action.get("chunk_id"));
                String source = action.get("source") != null ? String.valueOf(action.get("source")) : null;
                chunkSignalService.addBoost(chunkId, source, 1);
            } else if ("penalize_source".equals(type)) {
                String filename = action.get("filename") != null ? String.valueOf(action.get("filename")) : null;
                if (filename == null || filename.isBlank()) {
                    filename = action.get("source") != null ? String.valueOf(action.get("source")) : null;
                }
                if (filename != null && !filename.isBlank()) {
                    sourceSignalService.addSourcePenalty(filename, 1);
                }
            } else if ("boost_source".equals(type)) {
                String filename = action.get("filename") != null ? String.valueOf(action.get("filename")) : null;
                if (filename == null || filename.isBlank()) {
                    filename = action.get("source") != null ? String.valueOf(action.get("source")) : null;
                }
                if (filename != null && !filename.isBlank()) {
                    sourceSignalService.addSourceBoost(filename, 1);
                }
            } else if ("add_tag".equals(type)) {
                String filename = action.get("filename") != null ? String.valueOf(action.get("filename")) : null;
                String tagName = action.get("tag_name") != null ? String.valueOf(action.get("tag_name")) : null;
                Long documentId = resolveDocumentId(userId, filename, action.get("document_id"));
                if (documentId != null && tagName != null && !tagName.isBlank()) {
                    documentTagService.applyAiSuggestedTags(documentId, List.of(tagName));
                    actionService.logAction(feedbackId, turnId, 1, "add_tag", tagName, "success");
                }
            } else if ("reindex".equals(type)) {
                String filename = action.get("filename") != null ? String.valueOf(action.get("filename")) : null;
                Long documentId = resolveDocumentId(userId, filename, action.get("document_id"));
                if (documentId != null) {
                    reindexDocument(documentId, userId, feedbackId, turnId, filename);
                }
            }
        }
    }

    private Long resolveDocumentId(Long userId, String filename, Object documentIdRaw) {
        if (documentIdRaw instanceof Number n) {
            return n.longValue();
        }
        if (filename == null || filename.isBlank()) {
            return null;
        }
        KnowledgeDocument doc = documentMapper.selectOne(
                new LambdaQueryWrapper<KnowledgeDocument>()
                        .eq(KnowledgeDocument::getUserId, userId)
                        .eq(KnowledgeDocument::getFilename, filename)
                        .last("LIMIT 1")
        );
        return doc != null ? doc.getId() : null;
    }

    private void reindexDocument(Long documentId, Long userId, Long feedbackId, Long turnId, String filename) {
        KnowledgeDocument doc = documentMapper.selectById(documentId);
        if (doc == null || !userId.equals(doc.getUserId())) {
            actionService.logAction(feedbackId, turnId, 1, "reindex", "document not found", "skipped");
            return;
        }
        String sourceKey = filename != null ? filename : doc.getFilename();
        if (actionService.hasRecentReindexForTurnSource(turnId, sourceKey, 24)) {
            actionService.logAction(feedbackId, turnId, 1, "reindex", "rate limited 24h", "skipped");
            return;
        }
        try {
            knowledgeDocumentService.reindexDocumentById(documentId, userId);
            actionService.logAction(feedbackId, turnId, 1, "reindex", sourceKey, "success");
        } catch (Exception e) {
            actionService.logAction(feedbackId, turnId, 1, "reindex", e.getMessage(), "failed");
        }
    }
}
