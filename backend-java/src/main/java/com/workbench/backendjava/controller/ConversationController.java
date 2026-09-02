package com.workbench.backendjava.controller;

import com.workbench.backendjava.common.Result;
import com.workbench.backendjava.dto.ChatMessageUpdateRequest;
import com.workbench.backendjava.dto.ChatMessagesCreateRequest;
import com.workbench.backendjava.dto.ConversationPatchRequest;
import com.workbench.backendjava.service.ConversationService;
import com.workbench.backendjava.vo.ConversationDetailVO;
import com.workbench.backendjava.vo.ConversationVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/conversations")
@RequiredArgsConstructor
public class ConversationController {

    private final ConversationService conversationService;

    @GetMapping
    public Result<List<ConversationVO>> listConversations() {
        return Result.ok(conversationService.listConversations());
    }

    @PostMapping
    public Result<ConversationVO> createConversation() {
        return Result.ok(conversationService.createConversation());
    }

    @GetMapping("/{id}")
    public Result<ConversationDetailVO> getConversation(@PathVariable Long id) {
        return Result.ok(conversationService.getConversationDetail(id));
    }

    /** 流式结束后写入一轮 user + assistant */
    @PostMapping("/{id}/messages")
    public Result<Void> saveMessages(
            @PathVariable Long id,
            @Valid @RequestBody ChatMessagesCreateRequest request
    ) {
        conversationService.saveMessagePair(id, request);
        return Result.ok(null);
    }

    /** 重新生成后更新 assistant 消息 */
    @PutMapping("/{conversationId}/messages/{messageId}")
    public Result<Void> updateAssistantMessage(
            @PathVariable Long conversationId,
            @PathVariable Long messageId,
            @Valid @RequestBody ChatMessageUpdateRequest request
    ) {
        conversationService.updateAssistantMessage(conversationId, messageId, request);
        return Result.ok(null);
    }

    @DeleteMapping("/{id}")
    public Result<Void> deleteConversation(@PathVariable Long id) {
        conversationService.deleteConversation(id);
        return Result.ok(null);
    }

    @PatchMapping("/{id}")
    public Result<ConversationVO> patchConversation(
            @PathVariable Long id,
            @RequestBody ConversationPatchRequest request
    ) {
        return Result.ok(conversationService.patchConversation(id, request));
    }
}
