package com.workbench.backendjava.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class UserUsageSummaryVO {

    private int days;
    private long totalTokens;
    private BigDecimal totalCostCny;
    private BigDecimal totalCostCnyMin;
    private BigDecimal totalCostCnyMax;
    private List<ModelUsageVO> byModel;
    private List<SceneUsageVO> byScene;
    private List<PricingSourceVO> pricingSources;

    @Data
    public static class ModelUsageVO {
        private String model;
        private String modelDisplayName;
        private String provider;
        private long callCount;
        private long promptTokens;
        private long completionTokens;
        private long totalTokens;
        private BigDecimal estimatedCostCny;
        private BigDecimal estimatedCostCnyMin;
        private BigDecimal estimatedCostCnyMax;
        private String sourceUrl;
        /** official | missing_pricing | legacy_incomplete */
        private String sourceStatus;
    }

    @Data
    public static class SceneUsageVO {
        private String scene;
        private String sceneLabel;
        private long callCount;
        private long totalTokens;
        private BigDecimal estimatedCostCny;
        private BigDecimal estimatedCostCnyMin;
        private BigDecimal estimatedCostCnyMax;
    }

    @Data
    public static class PricingSourceVO {
        private String model;
        private String sourceUrl;
        private String formula;
    }
}
