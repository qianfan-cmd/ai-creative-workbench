package com.workbench.backendjava.vo;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class AiFeedbackStatsVO {
    private long upCount;
    private long downCount;
    private long ragUp;
    private long ragDown;
    private long chatUp;
    private long chatDown;
    private List<AiFeedbackDownItemVO> recentDowns = new ArrayList<>();
    private List<RagFeedbackActionVO> recentRagActions = new ArrayList<>();
}
