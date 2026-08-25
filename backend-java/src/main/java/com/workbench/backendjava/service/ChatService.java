package com.workbench.backendjava.service;

import com.workbench.backendjava.client.PythonAiClient;
import com.workbench.backendjava.common.BusinessException;
import com.workbench.backendjava.common.LoginUserContext;
import com.workbench.backendjava.vo.ChatReplyVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.concurrent.CompletableFuture;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatService {

    private final PythonAiClient pythonAiClient;

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
     * 流式输出
     * @param message
     * @return
     */
    public SseEmitter streamChat(String message) {
        Long userId = LoginUserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(401, "未登录");
        }

        String trimmed = message.trim();
        log.info("Chat stream 调用 Python AI, userId={}, message={}", userId, trimmed);

        /**
         * SseEmitter是spring提供的sse发射器，代表一条管道
         * emitter.send(...)推一条事件
         * emitter.complete，正常结束，关闭连接
         * emitter.completeWithError(e)出错结束
         */
        SseEmitter emitter = new SseEmitter(120_000L); // 120s 超时

        /**
         * CompletableFuture java异步工具
         * runAsync(Runnable)跑异步任务
         */
        CompletableFuture.runAsync(() -> {
            try {
                // ① 先向 Python 要完整回复（可能等几秒～几十秒）
                String fullReply = pythonAiClient.chat(trimmed);

                // ② 再逐字 SSE 推给前端（和之前 stub 一样，只是内容变真 AI）
                for (char ch : fullReply.toCharArray()) {
                    emitter.send(SseEmitter.event()
                            .name("message")
                            .data(String.valueOf(ch)));
                    Thread.sleep(30);
                }
                emitter.send(SseEmitter.event()
                        .name("done")
                        .data("[DONE]"));
                emitter.complete();

            } catch (BusinessException e) {
                // Python 不可用 / 返回空 等
                log.error("流式 Chat 调用 AI 失败: {}", e.getMessage());
                emitter.completeWithError(e);
            } catch (IOException e) {
                emitter.completeWithError(e);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                emitter.completeWithError(e);
            }
        });

        return emitter;
    }
}
