package com.workbench.backendjava.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.workbench.backendjava.entity.User;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface UserMapper extends BaseMapper<User> {
}
