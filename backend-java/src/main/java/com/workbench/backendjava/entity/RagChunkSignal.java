package com.workbench.backendjava.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("rag_chunk_signal")
public class RagChunkSignal {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String chunkId;

    private String source;

    private Integer penalty;

    private Integer boost;

    private LocalDateTime updatedAt;
}
