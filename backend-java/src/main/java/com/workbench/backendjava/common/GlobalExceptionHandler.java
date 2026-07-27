package com.workbench.backendjava.common;

import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

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
