package com.workbench.backendjava.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.workbench.backendjava.common.BusinessException;
import com.workbench.backendjava.common.LoginUserContext;
import com.workbench.backendjava.entity.KnowledgeDocument;
import com.workbench.backendjava.entity.KnowledgeDocumentTag;
import com.workbench.backendjava.entity.Tag;
import com.workbench.backendjava.mapper.KnowledgeDocumentMapper;
import com.workbench.backendjava.mapper.KnowledgeDocumentTagMapper;
import com.workbench.backendjava.mapper.TagMapper;
import com.workbench.backendjava.vo.TagVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class KnowledgeDocumentTagService {

    private final KnowledgeDocumentTagMapper documentTagMapper;
    private final KnowledgeDocumentMapper documentMapper;
    private final TagMapper tagMapper;

    public List<TagVO> listTagsForDocument(Long documentId) {
        requireOwnedDocument(documentId);
        List<KnowledgeDocumentTag> relations = documentTagMapper.selectList(
                new LambdaQueryWrapper<KnowledgeDocumentTag>()
                        .eq(KnowledgeDocumentTag::getDocumentId, documentId)
        );
        if (relations.isEmpty()) {
            return List.of();
        }
        Set<Long> tagIds = relations.stream().map(KnowledgeDocumentTag::getTagId).collect(Collectors.toSet());
        Map<Long, Tag> tagMap = tagMapper.selectBatchIds(tagIds).stream()
                .collect(Collectors.toMap(Tag::getId, t -> t, (a, b) -> a));
        List<TagVO> out = new ArrayList<>();
        for (KnowledgeDocumentTag rel : relations) {
            Tag tag = tagMap.get(rel.getTagId());
            if (tag == null) continue;
            TagVO vo = new TagVO();
            vo.setId(tag.getId());
            vo.setName(tag.getName());
            vo.setColor(tag.getColor());
            vo.setCreatedAt(tag.getCreatedAt());
            out.add(vo);
        }
        return out;
    }

    @Transactional
    public List<TagVO> replaceUserTags(Long documentId, List<Long> tagIds) {
        requireOwnedDocument(documentId);

        Set<Long> desired = new LinkedHashSet<>();
        if (tagIds != null) {
            for (Long tagId : tagIds) {
                if (tagId != null) {
                    desired.add(tagId);
                }
            }
        }

        List<KnowledgeDocumentTag> current = documentTagMapper.selectList(
                new LambdaQueryWrapper<KnowledgeDocumentTag>()
                        .eq(KnowledgeDocumentTag::getDocumentId, documentId)
        );
        Set<Long> currentTagIds = current.stream()
                .map(KnowledgeDocumentTag::getTagId)
                .collect(Collectors.toCollection(HashSet::new));

        for (KnowledgeDocumentTag rel : current) {
            if (!desired.contains(rel.getTagId())) {
                documentTagMapper.deleteById(rel.getId());
            }
        }

        for (Long tagId : desired) {
            if (currentTagIds.contains(tagId)) {
                continue;
            }
            Tag tag = tagMapper.selectById(tagId);
            if (tag == null) {
                throw new BusinessException(404, "标签不存在: " + tagId);
            }
            KnowledgeDocumentTag rel = new KnowledgeDocumentTag();
            rel.setDocumentId(documentId);
            rel.setTagId(tagId);
            rel.setSource("user");
            rel.setCreatedAt(LocalDateTime.now());
            documentTagMapper.insert(rel);
        }

        return listTagsForDocument(documentId);
    }

    @Transactional
    public void applyAiSuggestedTags(Long documentId, List<String> tagNames) {
        if (tagNames == null || tagNames.isEmpty()) {
            return;
        }
        requireOwnedDocument(documentId);
        for (String name : tagNames) {
            if (name == null || name.isBlank()) continue;
            String trimmed = name.trim();
            if (trimmed.length() > 32) {
                trimmed = trimmed.substring(0, 32);
            }
            Tag tag = tagMapper.selectOne(
                    new LambdaQueryWrapper<Tag>().eq(Tag::getName, trimmed)
            );
            if (tag == null) {
                tag = new Tag();
                tag.setName(trimmed);
                tag.setColor("#0D9488");
                tagMapper.insert(tag);
            }
            KnowledgeDocumentTag exist = documentTagMapper.selectOne(
                    new LambdaQueryWrapper<KnowledgeDocumentTag>()
                            .eq(KnowledgeDocumentTag::getDocumentId, documentId)
                            .eq(KnowledgeDocumentTag::getTagId, tag.getId())
            );
            if (exist != null) continue;
            KnowledgeDocumentTag rel = new KnowledgeDocumentTag();
            rel.setDocumentId(documentId);
            rel.setTagId(tag.getId());
            rel.setSource("ai");
            rel.setCreatedAt(LocalDateTime.now());
            documentTagMapper.insert(rel);
        }
    }

    public Map<Long, List<TagVO>> listTagsForDocuments(List<Long> documentIds) {
        if (documentIds == null || documentIds.isEmpty()) {
            return Map.of();
        }
        List<KnowledgeDocumentTag> relations = documentTagMapper.selectList(
                new LambdaQueryWrapper<KnowledgeDocumentTag>()
                        .in(KnowledgeDocumentTag::getDocumentId, documentIds)
        );
        Set<Long> tagIds = relations.stream().map(KnowledgeDocumentTag::getTagId).collect(Collectors.toSet());
        Map<Long, Tag> tagMap = tagIds.isEmpty() ? Map.of() : tagMapper.selectBatchIds(tagIds).stream()
                .collect(Collectors.toMap(Tag::getId, t -> t, (a, b) -> a));

        return relations.stream().collect(Collectors.groupingBy(
                KnowledgeDocumentTag::getDocumentId,
                Collectors.mapping(rel -> {
                    Tag tag = tagMap.get(rel.getTagId());
                    if (tag == null) return null;
                    TagVO vo = new TagVO();
                    vo.setId(tag.getId());
                    vo.setName(tag.getName());
                    vo.setColor(tag.getColor());
                    vo.setCreatedAt(tag.getCreatedAt());
                    return vo;
                }, Collectors.filtering(v -> v != null, Collectors.toList()))
        ));
    }

    private void requireOwnedDocument(Long documentId) {
        Long userId = LoginUserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(401, "未登录");
        }
        KnowledgeDocument doc = documentMapper.selectById(documentId);
        if (doc == null || !userId.equals(doc.getUserId())) {
            throw new BusinessException(404, "文档不存在");
        }
    }
}
