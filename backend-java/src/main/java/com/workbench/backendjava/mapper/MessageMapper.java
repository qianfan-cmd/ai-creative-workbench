package com.workbench.backendjava.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.workbench.backendjava.entity.Message;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface MessageMapper extends BaseMapper<Message> {
}
