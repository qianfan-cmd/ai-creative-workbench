package com.workbench.backendjava.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.workbench.backendjava.entity.Conversation;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface ConversationMapper extends BaseMapper<Conversation> {
}
