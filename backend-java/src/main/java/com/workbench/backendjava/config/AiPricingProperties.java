package com.workbench.backendjava.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Data
@Component
@ConfigurationProperties(prefix = "app.ai-pricing")
public class AiPricingProperties {

    private Map<String, ModelPricing> models = new HashMap<>();

    /** provider 别名 → 定价配置键（如 seedream → doubao-seedream-5-0-260128） */
    private Map<String, String> providerAliases = new HashMap<>();

    @Data
    public static class ModelPricing {
        /** CNY per million prompt/input tokens (fixed-rate models e.g. embedding) */
        private BigDecimal inputPerMillion = BigDecimal.ZERO;
        /** CNY per million completion/output tokens (fixed-rate models) */
        private BigDecimal outputPerMillion = BigDecimal.ZERO;

        /** DeepSeek: off-peak input (cache miss) per million tokens */
        private BigDecimal inputCacheMissPerMillionMin = BigDecimal.ZERO;
        /** DeepSeek: peak input (cache miss) per million tokens */
        private BigDecimal inputCacheMissPerMillionMax = BigDecimal.ZERO;
        /** DeepSeek: off-peak output per million tokens */
        private BigDecimal outputPerMillionMin = BigDecimal.ZERO;
        /** DeepSeek: peak output per million tokens */
        private BigDecimal outputPerMillionMax = BigDecimal.ZERO;

        /** CNY per successfully generated image */
        private BigDecimal perImage = BigDecimal.ZERO;

        private String sourceUrl;
        private String formula;
    }

    public List<PricingSourceItem> listPricingSources() {
        List<PricingSourceItem> items = new ArrayList<>();
        for (Map.Entry<String, ModelPricing> entry : models.entrySet()) {
            ModelPricing pricing = entry.getValue();
            if (pricing.getSourceUrl() == null || pricing.getSourceUrl().isBlank()) {
                continue;
            }
            PricingSourceItem item = new PricingSourceItem();
            item.setModel(entry.getKey());
            item.setSourceUrl(pricing.getSourceUrl());
            item.setFormula(pricing.getFormula());
            items.add(item);
        }
        return items;
    }

    @Data
    public static class PricingSourceItem {
        private String model;
        private String sourceUrl;
        private String formula;
    }
}
