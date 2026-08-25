package com.workbench.backendjava.controller;

import com.workbench.backendjava.client.PythonAiClient;
import com.workbench.backendjava.common.Result;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiHealthController {

    private final PythonAiClient pythonAiClient;

    @GetMapping("/health")
    public Result<Map<String, String>> aiHealth() {
        boolean pythonOk = pythonAiClient.isHealthy();
        return Result.ok(Map.of(
                "java","ok",
                "python", pythonOk ? "ok" : "down"
        ));
    }
}
