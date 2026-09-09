package com.workbench.backendjava.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.workbench.backendjava.common.BusinessException;
import com.workbench.backendjava.common.LoginUserContext;
import com.workbench.backendjava.dto.ChatMessageUpdateRequest;
import com.workbench.backendjava.dto.ChatMessagesCreateRequest;
import com.workbench.backendjava.dto.ConversationPatchRequest;
import com.workbench.backendjava.entity.Conversation;
import com.workbench.backendjava.entity.Message;
import com.workbench.backendjava.mapper.ConversationMapper;
import com.workbench.backendjava.mapper.MessageMapper;
import com.workbench.backendjava.vo.ConversationDetailVO;
import com.workbench.backendjava.vo.ConversationVO;
import com.workbench.backendjava.vo.MessageVO;
import com.workbench.backendjava.util.ChatMultimodalUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Chat 历史会话 — MySQL 持久化，供左栏切换与多轮上下文。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ConversationService {

    private static final int TITLE_MAX_LEN = 30;
    /** 发给 LLM 的上下文上限（条数） */
    private static final int CONTEXT_MESSAGE_LIMIT = 20;

    private final ConversationMapper conversationMapper;
    private final MessageMapper messageMapper;
    private final AiFeedbackService aiFeedbackService;

    public List<ConversationVO> listConversations() {
        Long userId = requireUserId();
        List<Conversation> conversations = conversationMapper.selectList(
                new LambdaQueryWrapper<Conversation>()
                        .eq(Conversation::getUserId, userId)
                        .orderByDesc(Conversation::getPinned)
                        .orderByDesc(Conversation::getUpdatedAt)
        );
        return conversations.stream().map(this::toConversationVO).collect(Collectors.toList());
    }

    @Transactional
    public ConversationVO createConversation() {
        Long userId = requireUserId();
        Conversation conversation = new Conversation();
        conversation.setUserId(userId);
        conversation.setTitle("新对话");
        conversation.setPinned(0);
        conversation.setCreatedAt(LocalDateTime.now());
        conversation.setUpdatedAt(LocalDateTime.now());
        conversationMapper.insert(conversation);
        return toConversationVO(conversation);
    }

    public ConversationDetailVO getConversationDetail(Long conversationId) {
        Long userId = requireUserId();
        Conversation conversation = getOwnedConversation(conversationId, userId);

        List<Message> messages = messageMapper.selectList(
                new LambdaQueryWrapper<Message>()
                        .eq(Message::getConversationId, conversationId)
                        .orderByAsc(Message::getCreatedAt)
        );

        List<Long> assistantIds = messages.stream()
                .filter(m -> "assistant".equals(m.getRole()))
                .map(Message::getId)
                .collect(Collectors.toList());
        Map<Long, String> ratingMap = aiFeedbackService.getRatingMapForRefs(userId, "message", assistantIds);

        ConversationDetailVO vo = new ConversationDetailVO();
        vo.setId(conversation.getId());
        vo.setTitle(conversation.getTitle());
        vo.setMessages(messages.stream()
                .map(m -> toMessageVO(m, ratingMap.get(m.getId())))
                .collect(Collectors.toList()));
        return vo;
    }

    /**
     * 构建发给 Python 的多轮 messages 数组（DeepSeek / OpenAI 多模态格式）。
     * 只取最近 {@link #CONTEXT_MESSAGE_LIMIT} 条，再追加当前 user 句。
     */
    public List<Map<String, Object>> buildMessagesForLlm(
            Long conversationId,
            String currentUserMessage,
            List<String> currentImageUrls) {
        Long userId = requireUserId();
        getOwnedConversation(conversationId, userId);

        List<Message> history = messageMapper.selectList(
                new LambdaQueryWrapper<Message>()
                        .eq(Message::getConversationId, conversationId)
                        .orderByDesc(Message::getCreatedAt)
                        .last("LIMIT " + CONTEXT_MESSAGE_LIMIT)
        );
        history = new ArrayList<>(history);
        java.util.Collections.reverse(history);

        List<Map<String, Object>> messages = new ArrayList<>();
        for (Message msg : history) {
            Map<String, Object> item = new HashMap<>();
            item.put("role", msg.getRole());
            if ("user".equals(msg.getRole())) {
                ChatMultimodalUtil.ParsedUserContent parsed = ChatMultimodalUtil.parseUserContent(msg.getContent());
                item.put("content", ChatMultimodalUtil.buildLlmContent(parsed.text(), parsed.imageUrls()));
            } else {
                item.put("content", msg.getContent());
            }
            messages.add(item);
        }

        Map<String, Object> current = new HashMap<>();
        current.put("role", "user");
        current.put("content", ChatMultimodalUtil.buildLlmContent(currentUserMessage.trim(), currentImageUrls));
        messages.add(current);
        return messages;
    }

    @Transactional
    public void saveMessagePair(Long conversationId, ChatMessagesCreateRequest request) {
        Long userId = requireUserId();
        Conversation conversation = getOwnedConversation(conversationId, userId);

        Message userMsg = new Message();
        userMsg.setConversationId(conversationId);
        userMsg.setRole("user");
        userMsg.setContent(ChatMultimodalUtil.encodeUserContent(
                request.getUserContent(),
                request.getUserImageUrls()));
        userMsg.setCreatedAt(LocalDateTime.now());
        messageMapper.insert(userMsg);

        Message assistantMsg = new Message();
        assistantMsg.setConversationId(conversationId);
        assistantMsg.setRole("assistant");
        assistantMsg.setContent(request.getAssistantContent());
        assistantMsg.setCreatedAt(LocalDateTime.now());
        messageMapper.insert(assistantMsg);

        if ("新对话".equals(conversation.getTitle()) || conversation.getTitle().isBlank()) {
            conversation.setTitle(truncateTitle(ChatMultimodalUtil.parseUserContent(request.getUserContent()).text()));
        }
        conversation.setUpdatedAt(LocalDateTime.now());
        conversationMapper.updateById(conversation);

        log.info("Chat 消息入库, userId={}, conversationId={}", userId, conversationId);
    }

    @Transactional
    public void updateAssistantMessage(Long conversationId, Long messageId, ChatMessageUpdateRequest request) {
        Long userId = requireUserId();
        getOwnedConversation(conversationId, userId);

        Message message = messageMapper.selectById(messageId);
        if (message == null || !conversationId.equals(message.getConversationId())) {
            throw new BusinessException(404, "消息不存在");
        }
        if (!"assistant".equals(message.getRole())) {
            throw new BusinessException(400, "只能更新 assistant 消息");
        }

        message.setContent(request.getAssistantContent());
        messageMapper.updateById(message);

        Conversation conversation = conversationMapper.selectById(conversationId);
        if (conversation != null) {
            conversation.setUpdatedAt(LocalDateTime.now());
            conversationMapper.updateById(conversation);
        }
    }

    @Transactional
    public void deleteConversation(Long conversationId) {
        Long userId = requireUserId();
        getOwnedConversation(conversationId, userId);
        conversationMapper.deleteById(conversationId);
    }

    @Transactional
    public ConversationVO patchConversation(Long conversationId, ConversationPatchRequest request) {
        Long userId = requireUserId();
        Conversation conversation = getOwnedConversation(conversationId, userId);
        if (request.getTitle() != null) {
            String title = request.getTitle().trim();
            if (title.isEmpty()) {
                throw new BusinessException(400, "标题不能为空");
            }
            conversation.setTitle(truncateTitle(title));
        }
        if (request.getPinned() != null) {
            conversation.setPinned(Boolean.TRUE.equals(request.getPinned()) ? 1 : 0);
        }
        conversation.setUpdatedAt(LocalDateTime.now());
        conversationMapper.updateById(conversation);
        return toConversationVO(conversation);
    }

    private Long requireUserId() {
        Long userId = LoginUserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(401, "未登录");
        }
        return userId;
    }

    private Conversation getOwnedConversation(Long conversationId, Long userId) {
        Conversation conversation = conversationMapper.selectById(conversationId);
        if (conversation == null || !userId.equals(conversation.getUserId())) {
            throw new BusinessException(404, "会话不存在");
        }
        return conversation;
    }

    private String truncateTitle(String text) {
        String t = text.trim();
        if (t.length() <= TITLE_MAX_LEN) {
            return t;
        }
        return t.substring(0, TITLE_MAX_LEN) + "…";
    }

    private ConversationVO toConversationVO(Conversation conversation) {
        ConversationVO vo = new ConversationVO();
        vo.setId(conversation.getId());
        vo.setTitle(conversation.getTitle());
        vo.setPinned(conversation.getPinned() != null && conversation.getPinned() == 1);
        vo.setUpdatedAt(conversation.getUpdatedAt());
        return vo;
    }

    private MessageVO toMessageVO(Message message, String userFeedbackRating) {
        MessageVO vo = new MessageVO();
        vo.setId(message.getId());
        vo.setRole(message.getRole());
        ChatMultimodalUtil.applyParsedContent(vo, message.getContent());
        vo.setUserFeedbackRating(userFeedbackRating);
        return vo;
    }
}
