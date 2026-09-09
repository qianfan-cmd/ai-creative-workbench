package com.workbench.backendjava.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class AiFeedbackCreateRequest {

    @NotBlank
    @Pattern(regexp = "rag|chat|image_gen", message = "scene 无效")
    private String scene;

    @NotBlank
    @Pattern(regexp = "knowledge_turn|message|generation_job", message = "refType 无效")
    private String refType;

    @NotNull
    private Long refId;

    @NotBlank
    @Pattern(regexp = "up|down", message = "rating 无效")
    private String rating;

    /** 点踩可选：incomplete_list | wrong_fact | irrelevant | other */
    private String reason;

    /** 点踩补充说明，最多 512 字 */
    private String reasonDetail;
}
