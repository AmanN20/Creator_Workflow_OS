package com.creatorworkflow.controller;

import com.creatorworkflow.dto.AnalyticsDTO;
import com.creatorworkflow.security.SecurityUtils;
import com.creatorworkflow.service.AnalyticsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    public AnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    @GetMapping
    public ResponseEntity<AnalyticsDTO> getAnalytics() {
        Long userId = SecurityUtils.getCurrentUserId();
        AnalyticsDTO analytics = analyticsService.getAnalytics(userId);
        return ResponseEntity.ok(analytics);
    }
}
