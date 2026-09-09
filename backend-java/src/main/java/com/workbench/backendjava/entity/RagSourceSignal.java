package com.workbench.backendjava.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("rag_source_signal")
public class RagSourceSignal {

    @TableId
    private String source;

    private Integer penalty;

    private Integer boost;

    private LocalDateTime updatedAt;
}
