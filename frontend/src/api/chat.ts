import request from '@/api/request';
import type { ApiResponse } from '@/types/api';
import { getToken } from '@/utils/token'
import { parseApiError, parseHttpStatus, finalizeApiRequestError } from '@/utils/apiError';

/** 历史会话侧栏项 */
export interface ConversationVO {
    id: number
    title: string
    pinned?: boolean
    updatedAt?: string
}

export interface MessageVO {
    id: number
    role: 'user' | 'assistant'
    content: string
    imageUrls?: string[]
    userFeedbackRating?: 'up' | 'down'
}

export interface ConversationDetailVO {
    id: number
    title: string
    messages: MessageVO[]
}

/** 历史会话列表（侧栏只读展示，Phase C 接线切换） */
export async function listConversationsApi() {
    const res = await request.get<ApiResponse<ConversationVO[]>>('/conversations')
    return res.data.data
}

export async function createConversationApi() {
    const res = await request.post<ApiResponse<ConversationVO>>('/conversations')
    return res.data.data
}

export async function getConversationApi(conversationId: number) {
    const res = await request.get<ApiResponse<ConversationDetailVO>>(
        `/conversations/${conversationId}`,
    )
    return res.data.data
}

export async function deleteConversationApi(conversationId: number) {
    await request.delete<ApiResponse<null>>(`/conversations/${conversationId}`)
}

export async function patchConversationApi(
    conversationId: number,
    payload: { title?: string; pinned?: boolean },
) {
    const res = await request.patch<ApiResponse<ConversationVO>>(
        `/conversations/${conversationId}`,
        payload,
    )
    return res.data.data
}

export interface ChatMessagePairVO {
    userMessageId: number
    assistantMessageId: number
}

/** 发送时写入 user + assistant（assistant 可为空，流式结束后 update） */
export async function saveChatMessagesApi(
    conversationId: number,
    payload: { userContent: string; assistantContent: string; userImageUrls?: string[] },
) {
    const res = await request.post<ApiResponse<ChatMessagePairVO>>(
        `/conversations/${conversationId}/messages`,
        payload,
    )
    return res.data.data
}

/** 重新生成后更新 assistant 消息（Phase C 接线） */
export async function updateChatAssistantApi(
    conversationId: number,
    messageId: number,
    assistantContent: string,
) {
    await request.put<ApiResponse<null>>(
        `/conversations/${conversationId}/messages/${messageId}`,
        { assistantContent },
    )
}

/** 流式请求参数 */
export interface ChatStreamOptions {
    /** 可选：有值时 Java 从 DB 加载历史做多轮 LLM（Phase C 接线） */
    conversationId?: number
    /** 附图 URL（多模态） */
    imageUrls?: string[]
    onChunk: (chunk: string) => void
    onDone: () => void
}

/**
 * Chat SSE 流式：POST /api/chat/stream，message 事件 data 为 JSON 编码 chunk（保留 Markdown 换行）。
 * 支持 conversationId 多轮与 imageUrls 多模态附件。
 */
export async function chatStreamApi(
    message: string,
    options: ChatStreamOptions,
    signal?: AbortSignal,
) {
    const token = getToken();

    let res: Response
    try {
        res = await fetch('/api/chat/stream', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
                message,
                ...(options.conversationId != null ? { conversationId: options.conversationId } : {}),
                ...(options.imageUrls?.length ? { imageUrls: options.imageUrls } : {}),
            }),
            signal,
        })
    } catch (error) {
        throw finalizeApiRequestError(parseApiError(error))
    }

    if (!res.ok) {
        const errBody = await res.json().catch(() => null) as { message?: string } | null
        throw finalizeApiRequestError(parseHttpStatus(res.status, errBody?.message))
    }

    const reader = res.body?.getReader();
    if (!reader) {
        throw new Error('浏览器不支持流式响应');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.startsWith('event:')) {
                currentEvent = line.slice(6).trim();
                continue;
            }

            if (line.startsWith('data:')) {
                const data = line.slice(5).trim();

                if (currentEvent === 'done' || data === '[DONE]') {
                    options.onDone();
                } else if (currentEvent === 'error') {
                    throw new Error(data);
                } else if (currentEvent === 'message') {
                    // Python json.dumps 包装 chunk，还原含换行的 Markdown
                    let chunk = data;
                    try {
                        chunk = JSON.parse(data) as string;
                    } catch {
                        // 兼容旧格式裸文本
                    }
                    options.onChunk(chunk);
                }
                continue;
            }

            if (line === '') {
                currentEvent = '';
            }
        }
    }

    options.onDone();
}
