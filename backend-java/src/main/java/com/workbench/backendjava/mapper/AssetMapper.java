package com.workbench.backendjava.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.workbench.backendjava.entity.Asset;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface AssetMapper extends BaseMapper<Asset> {
}
