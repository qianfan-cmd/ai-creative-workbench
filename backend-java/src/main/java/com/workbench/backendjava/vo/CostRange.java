package com.workbench.backendjava.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Data
public class CostRange {

    private BigDecimal minCny;
    private BigDecimal maxCny;

    public static CostRange zero() {
        CostRange range = new CostRange();
        range.minCny = BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP);
        range.maxCny = BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP);
        return range;
    }

    public static CostRange fixed(BigDecimal amount) {
        BigDecimal scaled = scale(amount);
        CostRange range = new CostRange();
        range.minCny = scaled;
        range.maxCny = scaled;
        return range;
    }

    public CostRange add(CostRange other) {
        if (other == null) {
            return this;
        }
        CostRange sum = new CostRange();
        sum.minCny = scale(minCny.add(other.minCny));
        sum.maxCny = scale(maxCny.add(other.maxCny));
        return sum;
    }

    public boolean isSingleValue() {
        return minCny.compareTo(maxCny) == 0;
    }

    private static BigDecimal scale(BigDecimal value) {
        return value.setScale(4, RoundingMode.HALF_UP);
    }
}
