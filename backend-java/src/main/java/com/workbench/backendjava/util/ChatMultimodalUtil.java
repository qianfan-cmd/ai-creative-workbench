package com.workbench.backendjava.util;

import com.workbench.backendjava.vo.MessageVO;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Chat 多模态消息：DB 存储编码与 LLM OpenAI 格式互转。
 */
public final class ChatMultimodalUtil {

    private static final String IMAGE_META_PREFIX = "[[images:";
    private static final String IMAGE_META_SUFFIX = "]]\n";

    private ChatMultimodalUtil() {
    }

    public record ParsedUserContent(String text, List<String> imageUrls) {
    }

    public static String encodeUserContent(String text, List<String> imageUrls) {
        String trimmed = text == null ? "" : text.trim();
        if (imageUrls == null || imageUrls.isEmpty()) {
            return trimmed;
        }
        return IMAGE_META_PREFIX + String.join("||", imageUrls) + IMAGE_META_SUFFIX + trimmed;
    }

    public static ParsedUserContent parseUserContent(String raw) {
        if (raw == null) {
            return new ParsedUserContent("", List.of());
        }
        if (raw.startsWith(IMAGE_META_PREFIX)) {
            int end = raw.indexOf(IMAGE_META_SUFFIX);
            if (end > 0) {
                String urlsPart = raw.substring(IMAGE_META_PREFIX.length(), end);
                String body = raw.substring(end + IMAGE_META_SUFFIX.length());
                List<String> urls = urlsPart.isBlank()
                        ? List.of()
                        : List.of(urlsPart.split("\\|\\|", -1));
                return new ParsedUserContent(body, urls);
            }
        }
        return new ParsedUserContent(raw, List.of());
    }

    public static Object buildLlmContent(String text, List<String> imageUrls) {
        String trimmed = text == null ? "" : text.trim();
        if (imageUrls == null || imageUrls.isEmpty()) {
            return trimmed;
        }

        List<Map<String, Object>> parts = new ArrayList<>();
        Map<String, Object> textPart = new HashMap<>();
        textPart.put("type", "text");
        textPart.put("text", trimmed.isEmpty() ? "请描述这张图片" : trimmed);
        parts.add(textPart);

        for (String url : imageUrls) {
            if (url == null || url.isBlank()) {
                continue;
            }
            Map<String, Object> imagePart = new HashMap<>();
            imagePart.put("type", "image_url");
            Map<String, String> imageUrl = new HashMap<>();
            imageUrl.put("url", url);
            imagePart.put("image_url", imageUrl);
            parts.add(imagePart);
        }
        return parts;
    }

    public static List<Map<String, Object>> singleTurnMessages(String text, List<String> imageUrls) {
        List<Map<String, Object>> messages = new ArrayList<>();
        Map<String, Object> userMsg = new HashMap<>();
        userMsg.put("role", "user");
        userMsg.put("content", buildLlmContent(text, imageUrls));
        messages.add(userMsg);
        return messages;
    }

    public static void applyParsedContent(MessageVO vo, String rawContent) {
        ParsedUserContent parsed = parseUserContent(rawContent);
        vo.setContent(parsed.text());
        if (!parsed.imageUrls().isEmpty()) {
            vo.setImageUrls(parsed.imageUrls());
        }
    }
}
