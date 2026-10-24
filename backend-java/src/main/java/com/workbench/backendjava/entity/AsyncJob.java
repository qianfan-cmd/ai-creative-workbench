package com.workbench.backendjava.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("async_job")
public class AsyncJob {
    @TableId(type = IdType.AUTO)

    private Long id;

    private Long userId;

    /** 见 {@link com.workbench.backendjava.common.AsyncJobConstants} TYPE_* */
    private String type;

    /** 见 AsyncJobConstants STATUS_* */
    private String status;

    /** JSON 字符串，如 {"documentId":42,"filename":"notes.pdf"} */
    private String payloadJson;

    private String errorMessage;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
