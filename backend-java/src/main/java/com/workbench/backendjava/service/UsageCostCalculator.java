package com.workbench.backendjava.service;

import com.workbench.backendjava.config.AiPricingProperties;
import com.workbench.backendjava.vo.CostRange;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Component
@RequiredArgsConstructor
public class UsageCostCalculator {

    private static final BigDecimal ONE_MILLION = BigDecimal.valueOf(1_000_000L);
    private static final String SCENE_MATTING_DETECT = "matting_detect";
    private static final String MODEL_QWEN_VL_MAX = "qwen-vl-max";

    private final AiPricingProperties aiPricingProperties;

    public CostRange estimateCostRange(String model, String provider, Integer promptTokens,
                                       Integer completionTokens, Integer totalTokens,
                                       Integer imageCount) {
        return estimateCostRange(model, provider, null, promptTokens, completionTokens, totalTokens, imageCount);
    }

    public CostRange estimateCostRange(String model, String provider, String scene,
                                       Integer promptTokens, Integer completionTokens, Integer totalTokens,
                                       Integer imageCount) {
        EffectiveUsage usage = resolveEffectiveUsage(model, provider, scene);
        String pricingKey = resolvePricingKey(usage.model(), usage.provider());
        AiPricingProperties.ModelPricing pricing = aiPricingProperties.getModels().get(pricingKey);

        if (pricing == null) {
            return CostRange.zero();
        }

        int images = imageCount != null && imageCount > 0 ? imageCount : 0;
        if (pricing.getPerImage().signum() > 0) {
            int billableImages = images > 0 ? images : 1;
            return CostRange.fixed(pricing.getPerImage().multiply(BigDecimal.valueOf(billableImages)));
        }

        int prompt = promptTokens != null ? promptTokens : 0;
        int completion = completionTokens != null ? completionTokens : 0;
        int total = totalTokens != null ? totalTokens : (prompt + completion);

        if (hasDeepSeekRange(pricing) && (prompt > 0 || completion > 0)) {
            BigDecimal inputMin = perMillionCost(prompt, pricing.getInputCacheMissPerMillionMin());
            BigDecimal inputMax = perMillionCost(prompt, pricing.getInputCacheMissPerMillionMax());
            BigDecimal outputMin = perMillionCost(completion, pricing.getOutputPerMillionMin());
            BigDecimal outputMax = perMillionCost(completion, pricing.getOutputPerMillionMax());
            CostRange range = new CostRange();
            range.setMinCny(scale(inputMin.add(outputMin)));
            range.setMaxCny(scale(inputMax.add(outputMax)));
            return range;
        }

        if (total > 0 && (pricing.getInputPerMillion().signum() > 0 || pricing.getOutputPerMillion().signum() > 0)) {
            int inputTokens = prompt > 0 ? prompt : total;
            BigDecimal inputCost = perMillionCost(inputTokens, pricing.getInputPerMillion());
            BigDecimal outputCost = perMillionCost(completion, pricing.getOutputPerMillion());
            return CostRange.fixed(inputCost.add(outputCost));
        }

        return CostRange.zero();
    }

    /** @deprecated 保留兼容；请使用 estimateCostRange */
    public BigDecimal estimateCost(String model, String provider, Integer promptTokens,
                                   Integer completionTokens, Integer totalTokens) {
        return estimateCostRange(model, provider, promptTokens, completionTokens, totalTokens, null)
                .getMaxCny();
    }

    public String resolveSourceUrl(String model, String provider) {
        return resolveSourceUrl(model, provider, null);
    }

    public String resolveSourceUrl(String model, String provider, String scene) {
        EffectiveUsage usage = resolveEffectiveUsage(model, provider, scene);
        return resolveSourceUrlByPricingKey(resolvePricingKey(usage.model(), usage.provider()));
    }

    public String resolveSourceUrlByPricingKey(String pricingKey) {
        AiPricingProperties.ModelPricing pricing = aiPricingProperties.getModels().get(pricingKey);
        return pricing != null ? pricing.getSourceUrl() : null;
    }

    /** 汇总分组用的标准化定价键（如 dashscope_wanx → wan2.7-image-pro） */
    public String normalizeGroupKey(String model, String provider, String scene) {
        EffectiveUsage usage = resolveEffectiveUsage(model, provider, scene);
        return resolvePricingKey(usage.model(), usage.provider());
    }

    public EffectiveUsage resolveEffectiveUsage(String model, String provider, String scene) {
        String effectiveModel = model;
        String effectiveProvider = provider;

        if (!StringUtils.hasText(effectiveModel) && !StringUtils.hasText(effectiveProvider)
                && SCENE_MATTING_DETECT.equals(scene)) {
            effectiveModel = MODEL_QWEN_VL_MAX;
            effectiveProvider = "dashscope";
        }

        if ("matting_detect".equals(effectiveModel)) {
            effectiveModel = MODEL_QWEN_VL_MAX;
            if (!StringUtils.hasText(effectiveProvider)) {
                effectiveProvider = "dashscope";
            }
        }

        return new EffectiveUsage(effectiveModel, effectiveProvider);
    }

    public String resolvePricingKey(String model, String provider) {
        if (StringUtils.hasText(model) && aiPricingProperties.getModels().containsKey(model)) {
            return model;
        }
        if (StringUtils.hasText(model)) {
            String modelAlias = aiPricingProperties.getProviderAliases().get(model);
            if (StringUtils.hasText(modelAlias) && aiPricingProperties.getModels().containsKey(modelAlias)) {
                return modelAlias;
            }
        }
        if (StringUtils.hasText(provider)) {
            String alias = aiPricingProperties.getProviderAliases().get(provider);
            if (StringUtils.hasText(alias) && aiPricingProperties.getModels().containsKey(alias)) {
                return alias;
            }
            if (aiPricingProperties.getModels().containsKey(provider)) {
                return provider;
            }
        }
        if (StringUtils.hasText(model)) {
            return model;
        }
        return provider != null ? provider : "unknown";
    }

    private static boolean hasDeepSeekRange(AiPricingProperties.ModelPricing pricing) {
        return pricing.getOutputPerMillionMin().signum() > 0
                || pricing.getOutputPerMillionMax().signum() > 0;
    }

    private static BigDecimal perMillionCost(int tokens, BigDecimal pricePerMillion) {
        if (tokens <= 0 || pricePerMillion.signum() <= 0) {
            return BigDecimal.ZERO;
        }
        return pricePerMillion
                .multiply(BigDecimal.valueOf(tokens))
                .divide(ONE_MILLION, 6, RoundingMode.HALF_UP);
    }

    private static BigDecimal scale(BigDecimal value) {
        return value.setScale(4, RoundingMode.HALF_UP);
    }

    public record EffectiveUsage(String model, String provider) {
    }
}
