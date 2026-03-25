package com.creatorworkflow.controller;

import com.creatorworkflow.dto.ContentPostDTO;
import com.creatorworkflow.security.SecurityUtils;
import com.creatorworkflow.service.ContentPostService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/schedule")
public class ScheduleController {

    private final ContentPostService contentPostService;

    public ScheduleController(ContentPostService contentPostService) {
        this.contentPostService = contentPostService;
    }

    @PostMapping
    public ResponseEntity<ContentPostDTO> schedulePost(@RequestBody Map<String, Object> body) {
        Long userId = SecurityUtils.getCurrentUserId();
        Long postId = Long.valueOf(body.get("postId").toString());
        LocalDateTime scheduledAt = LocalDateTime.parse(body.get("scheduledAt").toString());

        ContentPostDTO result = contentPostService.schedulePost(userId, postId, scheduledAt);
        return ResponseEntity.ok(result);
    }

    @GetMapping
    public ResponseEntity<List<ContentPostDTO>> getScheduledPosts(
            @RequestParam(required = false) String start,
            @RequestParam(required = false) String end) {
        Long userId = SecurityUtils.getCurrentUserId();

        LocalDateTime startDate = start != null ? LocalDate.parse(start).atStartOfDay()
                : LocalDate.now().withDayOfMonth(1).atStartOfDay();
        LocalDateTime endDate = end != null ? LocalDate.parse(end).plusDays(1).atStartOfDay()
                : LocalDate.now().plusMonths(1).withDayOfMonth(1).atStartOfDay();

        List<ContentPostDTO> posts = contentPostService.getScheduledPosts(userId, startDate, endDate);
        return ResponseEntity.ok(posts);
    }
}
