import request from '@/api/request';
import type { ApiResponse } from '@/types/api';
import { getToken } from '@/utils/token'

export interface ChatRelyVO {
    reply: string;
}

export async function chatApi(message: string) {
    const res = await request.post<ApiResponse<ChatRelyVO>>('/chat', { message });
    return res.data.data;
}

/**处理流式响应的回调函数 
 * 为什么用fetch请求而不是axios，因为axios默认把响应当 一整份json处理，不适合边收边读。
sse是text/event-stream长连接，需要读response.body流。
Res.body: ReadableStream
.getReader():一段段读
*/
export interface ChatStreamHandlers {
    onChunk: (chunk: string) => void; // 处理流式响应的每一块数据
    onDone: () => void; // 处理流式响应完成
}

export async function chatStreamApi(message: string, handlers: ChatStreamHandlers, signal?: AbortSignal) {
    const token = getToken();
    
    const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message }),
        signal, // 传给fetch，外部AbortController.signal触发abort时用，用于停止生成
    })

    if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.message || `请求失败 (${res.status})`);
    }

    /**
     * res.body响应体流，不是一次性字符串
     * getReader()拿到ReadableStreamDefaultReader，用来read()
     * reader.read()每次读一块二进制Uint8Array，直到读到done:true
     */
    const reader = res.body?.getReader();
    if (!reader) {
        throw new Error('浏览器不支持流式响应');
    }

    const decoder = new TextDecoder(); // 把字节Uint8Array转成字符串UTF-8
    let buffer = '';
    let currentEvent = '';

    while (true) {
        const { done, value } = await reader.read(); /**后端complete后done会变成true */
        if (done) break;

/**把字节解码成字符串，stream: true多字节字符可能被拆在两个chunk里，解码器自动判断边界 */
        buffer += decoder.decode(value, { stream: true }); 
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // pop()从数组中删除最后一个元素，并返回元素的值。最后一行可能不完整，先暂存到buffer


        /**
         * event: message
           data: 收

           event: message
           data: 到

           event: done
           data: [DONE]

           判断是否是事件类型行，是的话去掉event:
         */
        for (const line of lines) {
            if (line.startsWith('event:')) {
                currentEvent = line.slice(6).trim();
                continue;
            }

            if (line.startsWith('data:')) {
                const data = line.slice(5).trim();

                if (currentEvent === 'done' || data === '[DONE]') {
                    handlers.onDone();
                } else {
                    handlers.onChunk(data);
                }
                continue;
            }

            if (line === '') {
                currentEvent = '';
            }
        }
    }

    handlers.onDone();
}