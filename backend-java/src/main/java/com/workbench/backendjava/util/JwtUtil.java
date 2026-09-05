package com.workbench.backendjava.util;

import com.workbench.backendjava.common.UserRole;
import com.workbench.backendjava.config.JwtProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
@RequiredArgsConstructor
public class JwtUtil {

    private final JwtProperties jwtProperties;

    /**
     * 生成token，把userId放进subject
     */
    public String generateToken(Long userId, String username, String role) {
        SecretKey key = Keys.hmacShaKeyFor(
                jwtProperties.getSecret().getBytes(StandardCharsets.UTF_8)
        );

        Date now = new Date();
        Date expireAt = new Date(now.getTime() + jwtProperties.getExpiration());

        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claim("username", username)
                .claim("role", role != null ? role : UserRole.USER)
                .issuedAt(now)
                .expiration(expireAt)
                .signWith(key)
                .compact();
    }

    public String getRole(String token) {
        Object role = parseToken(token).get("role");
        return role != null ? role.toString() : UserRole.USER;
    }

    /**
     * 解析token，后面周四/周五/api/auth/me
     */
    public Claims parseToken(String token) {
        SecretKey key = Keys.hmacShaKeyFor(
                jwtProperties.getSecret().getBytes(StandardCharsets.UTF_8)
        );

        return Jwts.parser()                            // 1. 创建解析器
                .verifyWith(key)                        // 2. 传入相同的“密钥钢印”进行校验
                .build()                                // 3. 构建解析器实例
                .parseSignedClaims(token)               // 4. 解析并验证 Token（如果被篡改过或格式不对，这里会直接抛异常！）
                .getPayload();                          // 5. 验印通过，获取防伪通行证里的完整内容（即 Claims 对象）
    }

    /**
     *verifyWith(key)只是把key存进JwtParserBuilder对象的内存中，此时token并没有传入，代码只是构建了一个验证器
     * parseSignedClaims(token)才是真正开始验证的，在接收到token后执行了五步
     * 1.拆解：按.把token拆成header、payload、signature三段
     * 2.解码：把header、payload部分从base64url还原成原始的json字符串
     * 3.用key计算指纹：JWT把key拿出来对header、payload部分进行HMAC-SHA哈希计算，生成本次的实时签名
     * 4.对比：把算出来的签名跟token中的签名对比，如果相同，则说明token是合法的，否则就是被篡改的
     *
     * 【生成 token】                         【解析 token】
     *
     * secret → key                           secret → key（必须相同）
     *    ↓                                      ↓
     * Jwts.builder()                         Jwts.parser()
     *    .subject(userId)                       .verifyWith(key)
     *    .claim("username", ...)                    .build()
     *    .issuedAt / .expiration                    .parseSignedClaims(token)
     *    .signWith(key)  ──盖章──► Signature           │
     *    .compact()  ──► "a.b.c"                        ├─ 拆成 a.b.c
     *                                                   ├─ 用 key 重算签名
     *                                                   ├─ 比对 Signature
     *                                                   ├─ 检查 exp
     *                                                   └─ .getPayload() → Claims
     */

    /**
     * 获取userId
     */
    public Long getUserId(String token) {
        String subject = parseToken(token).getSubject();
        return Long.valueOf(subject);
    }

    /**
     * 判断token是否过期
     */
    public boolean isExpired(String token) {
        Date expiration = parseToken(token).getExpiration();
        return expiration.before(new Date());
    }
}
