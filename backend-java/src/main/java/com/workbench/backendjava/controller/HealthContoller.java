package com.workbench.backendjava.controller;

import com.workbench.backendjava.common.Result;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class HealthContoller {

    @GetMapping("/health")
    public Result<Map<String, String>> health() {
        return Result.ok(Map.of(
                "status", "ok",
                "service", "backend-java"
        ));
    }
}
