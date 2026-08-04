package com.workbench.backendjava.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.workbench.backendjava.common.LoginUserContext;
import com.workbench.backendjava.common.Result;
import com.workbench.backendjava.util.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
@RequiredArgsConstructor // 自动生成一个包含所有final属性或标记了@NonNull/@NotNull的构造函数
public class AuthInterceptor implements HandlerInterceptor {

    private final JwtUtil jwtUtil;
    private final ObjectMapper objectMapper;

    /**
     * preHandle()前置处理：在请求进入Controller之前执行
     * return true：放行，请求继续传给后面的controller
     * return false：拦截请求，不再往下传
     * @param request
     * @param response
     * @param handler
     * @return
     * @throws Exception
     */
    @Override
    public boolean preHandle(HttpServletRequest request,
                             HttpServletResponse response,
                             Object handler) throws Exception {

        /**
         * HTTP协议定义了一套标准，Authorization: Bearer <token>专门用来传身份认证信息的Header键名
         */
        // 从Header取token
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            writeUnauthorized(response, "未完成登录或 token 无效");
            return false;
        }

        /**
         * Bearer是标识认证类型：认证的方式有很多种，如Bearer，Basic，Digest，OAuth，Negotiate，NTLM等等
         * Bearer是一种授权模式，它把用户凭证（如用户名、密码）放在请求头中，而不是放在请求体中。
         */
        String token = authHeader.substring(7);// 去掉Bearer

        try {
            // 解析 token，获取userId
            Long userId = jwtUtil.getUserId(token);

            // 存入上下文，后面在service中直接用
            LoginUserContext.setUserId(userId);
            return true;

        } catch (Exception e) {
            writeUnauthorized(response, "未登录或 token 无效");
            return false;
        }


    }

    /**
     * 响应结束，清除上下文
     * afterCompletion(): 在整个请求全部处理完，响应发送完之后执行
     * @param request
     * @param response
     * @param handler
     * @param ex
     */
    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        LoginUserContext.clear();
    }

    /**
     * 响应未授权
     * 拦截器是在Controller之前执行的，如果拦截器选择拦截请求，此时就无法依靠Controller里的@RestController自动把
     * 对象转成json了。所以必须手动把错误信息写回给前端
     * @param response
     * @param message
     * @throws Exception
     */
    private void writeUnauthorized(HttpServletResponse response, String message) throws Exception {
        /**
         * throws Exception的意思是我这个函数可能会抛出异常，如果抛出了异常那么把这个异常交给调用者处理
         */

        /**
         * 这么设置的原因跟响应的http报文格式有关系
         *
         * ========================================================================================================
         * Tomcat会把你在Java中设置的内容，拼装成下面这样的纯文本报文发回给浏览器：
         * http
         * HTTP/1.1 200 OK                              [状态行：协议 + 状态码 + 信息]
         * Content-Type: application/json;charset=UTF-8 [响应头：告诉浏览器返回的是什么类型]
         * Date: Wed, 04 Aug 2026 10:00:00 GMT
         * {"code":0,"message":"登录成功","data":null}   [响应体：返回的具体内容]
         * ========================================================================================================
         *
         * 你要设置的内容	操作方法	关键格式约定
         * 状态码 (Status)	response.setStatus(401)	必须设置数字，常见 200(成功)、404(路径不对)、500(后台报错)
         * 响应头 (Header)	response.setHeader("token", "abc123")	键值对字符串，常用于告诉客户端缓存策略或下发新Token
         * 响应体的内容类型	response.setContentType("application/json")	极其重要！告诉浏览器以什么格式解析数据。如果是返回HTML写 text/html，返回JS写 application/javascript
         * 响应体的编码	response.setCharacterEncoding("UTF-8")	防止中文乱码，必须和 ContentType 配合使用
         * 响应体的内容	response.getWriter().print("字符串内容")	通过字符流输出文本；response.getOutputStream().write(字节数组) 输出图片/文件流
         */
        response.setStatus(401);
        response.setContentType("application/json;charset=UTF-8");
        Result<Void> result = Result.fail(401, message);
        response.getWriter().write(objectMapper.writeValueAsString(result));
    }
}
