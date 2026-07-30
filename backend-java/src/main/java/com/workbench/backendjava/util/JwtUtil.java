package com.workbench.backendjava.util;

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
    public String generateToken(Long userId, String username) {
        SecretKey key = Keys.hmacShaKeyFor(
                jwtProperties.getSecret().getBytes(StandardCharsets.UTF_8)
        );

        Date now = new Date();
        Date expireAt = new Date(now.getTime() + jwtProperties.getExpiration());

        return Jwts.builder() // 创建jwt建造者，开始拼装通行证
                .subject(String.valueOf(userId))
                .claim("username", username)
                .issuedAt(now)
                .expiration(expireAt)
                .signWith(key)
                .compact();

        /**
         *         return Jwts.builder() // 创建jwt建造者，开始拼装通行证
         *
         *                 .subject(String.valueOf(userId)) // 标准注册字段，标识令牌主体
         *                 .claim("username", username) // 自定义私有字段
         *                 .issuedAt(now) // 标准注册字段，令牌签发时间
         *                 .expiration(expireAt) // 标准注册字段，令牌过期时间（服务器会严格校验这个时间)
         *                 构建完这部分，Payload 的 JSON 大概是：{"sub":"1001","username":"张三","iat":...,"exp":...}
         *
         *                 .signWith(key) // 隐式生成header，jwt的header包含typ和alg(类型和签名算法)，这个根据key生成
         *                 {
         *                    "alg": "HS256",  // 如果 key 是 HMAC 密钥，自动选 HS256/HS384/HS512
         *                    "typ": "JWT"
         *                 }
         *                 .compact();
         *                 signWith(key)告诉JJWT使用这个密钥，对Header+Payload的拼接字符串进行哈希签名，生成signature
         *                 签名动作是在.compact()时进行的
         *                 此时会
         *                 1.把Header和Payload分别做Base64Url编码
         *                 2.用.拼接他们
         *                 3.拿拼接后的字符串+传入的key算出签名值
         *                 4.把签名值做Base64Url编码再拼接到末尾
         *                 运行compact()后的字符串大概长这样
         *                 eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.
         *                 eyJzdWIiOiIxMDAxIiwidXNlcm5hbWUiOiLlvKDkuIkiLCJpYXQiOjE3MjIyMzQ1NjcsImV4cCI6MTcyMjIzODE2N30.
         *                 2T9iXoxWn0n0n0n0n0n0n0n0n0n0n0n0n0n0n0n0
         */
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
