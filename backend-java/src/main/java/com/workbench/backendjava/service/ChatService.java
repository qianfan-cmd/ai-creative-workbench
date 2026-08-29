package com.workbench.backendjava.service;

import com.workbench.backendjava.client.PythonAiClient;
import com.workbench.backendjava.common.BusinessException;
import com.workbench.backendjava.common.LoginUserContext;
import com.workbench.backendjava.dto.ChatStreamRequest;
import com.workbench.backendjava.vo.ChatReplyVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatService {

    private final PythonAiClient pythonAiClient;
    private final ConversationService conversationService;

    public ChatReplyVO chat(String message) {
        Long userId = LoginUserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(401, "未登录");
        }

        String trimmed = message.trim();
        log.info("Chat 调用 Python AI, userId={}, message={}", userId, trimmed);
        String reply = pythonAiClient.chat(trimmed);
        ChatReplyVO vo = new ChatReplyVO();
        vo.setReply(reply);
        return vo;
    }

    /**
     * 真 SSE 流式 Chat — 转发 Python /ai/chat/stream。
     * 有 conversationId 时从 DB 加载历史拼多轮 messages。
     */
    public SseEmitter streamChat(ChatStreamRequest request) {
        Long userId = LoginUserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(401, "未登录");
        }

        String trimmed = request.getMessage().trim();
        log.info("Chat stream, userId={}, conversationId={}, message={}",
                userId, request.getConversationId(), trimmed);

        List<Map<String, String>> messages;
        if (request.getConversationId() != null) {
            messages = conversationService.buildMessagesForLlm(request.getConversationId(), trimmed);
        } else {
            // 无会话 id：单轮（Phase B 默认路径）
            messages = new ArrayList<>();
            Map<String, String> userMsg = new HashMap<>();
            userMsg.put("role", "user");
            userMsg.put("content", trimmed);
            messages.add(userMsg);
        }

        SseEmitter emitter = new SseEmitter(120_000L);
        pythonAiClient.chatStream(messages, emitter);
        return emitter;
    }
}
