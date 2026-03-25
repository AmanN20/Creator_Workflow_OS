package com.creatorworkflow.controller;

import com.creatorworkflow.dto.RecommendationDTO;
import com.creatorworkflow.security.SecurityUtils;
import com.creatorworkflow.service.RecommendationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/recommendation")
public class RecommendationController {

    private final RecommendationService recommendationService;

    public RecommendationController(RecommendationService recommendationService) {
        this.recommendationService = recommendationService;
    }

    @GetMapping
    public ResponseEntity<RecommendationDTO> getRecommendation() {
        Long userId = SecurityUtils.getCurrentUserId();
        RecommendationDTO recommendation = recommendationService.getRecommendation(userId);
        return ResponseEntity.ok(recommendation);
    }
}
