package com.workbench.backendjava.vo;

import lombok.Data;

@Data
public class AiFeedbackStatsVO {
    private long upCount;
    private long downCount;
    private long ragUp;
    private long ragDown;
    private long chatUp;
    private long chatDown;
}
