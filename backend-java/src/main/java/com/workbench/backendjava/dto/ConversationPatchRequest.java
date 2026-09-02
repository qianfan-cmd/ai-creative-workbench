package com.workbench.backendjava.dto;

import lombok.Data;

@Data
public class ConversationPatchRequest {
    private String title;
    private Boolean pinned;
}
