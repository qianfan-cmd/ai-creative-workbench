package com.workbench.backendjava.vo;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class MattingSidebarVO {
    private List<MattingTaskGroupVO> groups = new ArrayList<>();
    private List<MattingTaskVO> tasks = new ArrayList<>();
}
