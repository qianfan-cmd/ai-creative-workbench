package com.workbench.backendjava.controller;

import com.workbench.backendjava.common.Result;
import com.workbench.backendjava.dto.ChatRequest;
import com.workbench.backendjava.service.ChatService;
import com.workbench.backendjava.vo.ChatReplyVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;

    @PostMapping
    public Result<ChatReplyVO> chat(@Valid @RequestBody ChatRequest request) {
        return Result.ok(chatService.chat(request.getMessage()));
    }

    /**
     * 流式接口
     * produces的意思是响应类型是text/event-stream，是sse标准mime
     * 返回SseEmitter，是流式连接对象，告诉浏览器这是一条会持续推送的事件流
     * @param request
     * @return
     */
    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@Valid @RequestBody ChatRequest request) {
        return chatService.streamChat(request.getMessage());
    }
}
