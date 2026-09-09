package com.workbench.backendjava.common;

import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MultipartException;

/**
 * 全局统一异常拦截器
 * 封装成统一的Result返回
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * 捕获自定义业务异常
     */
    @ExceptionHandler(BusinessException.class)
    public Result<String> handleBusinessException(BusinessException e) {
        log.warn("业务捕获到自定义异常：{}", e.getMessage());
        return Result.fail(e.getCode(), e.getMessage());
    }

    /**
     * 捕获系统未知异常
     */
    @ExceptionHandler(Exception.class)
    public Result<String> handleException(Exception e) {
        log.error("系统发生未捕获的未知异常：", e);
        return Result.fail(500, "服务器错误");
    }

    /** multipart 解析失败（如超过 Tomcat part 数 / 请求体过大） */
    @ExceptionHandler(MultipartException.class)
    public Result<String> handleMultipartException(MultipartException e) {
        log.warn("multipart 解析失败: {}", e.getMessage());
        String msg = e.getMessage() != null && e.getMessage().contains("FileCountLimit")
                ? "单次上传文件过多，请不超过 20 个或分批上传"
                : "上传请求无效或体积过大，请减少文件数量或缩小单文件体积";
        return Result.fail(400, msg);
    }

    /**
     * 捕获请求体参数校验失败（spring boot会抛出MethodArgumentNotValidException错误
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public Result<Void> handleValidation(MethodArgumentNotValidException e) {
        /**
         * 从异常对象中获取绑定结果（BindingResult），然后取出第一个字段级别的错误（FieldError）。
         * 比如用户提交了 username: ""，触发了 @NotBlank(message = "用户名不能为空")，这里的 fieldError 就记录了这个错误信息。
         */
        FieldError fieldError = e.getBindingResult().getFieldError();
        String message = fieldError != null ? fieldError.getDefaultMessage() : "参数校验失败";
        return Result.fail(400, message);
    }
}
