package com.workbench.backendjava.entity;

import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 标签表
 */
@Data
@TableName("tag")
public class Tag {
    private Long id;

    /**
     * 标签名称
     */
    private String name;

    /**
     * 标签颜色
     */
    private String color;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @TableLogic
    private Integer deleted;
}
