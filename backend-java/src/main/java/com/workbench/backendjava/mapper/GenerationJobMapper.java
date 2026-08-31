package com.workbench.backendjava.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.workbench.backendjava.entity.GenerationJob;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface GenerationJobMapper extends BaseMapper<GenerationJob> {
}
