package com.creatorworkflow.controller;

import com.creatorworkflow.dto.ContentPostDTO;
import com.creatorworkflow.security.SecurityUtils;
import com.creatorworkflow.service.ContentPostService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/content")
public class ContentController {

    private final ContentPostService contentPostService;

    public ContentController(ContentPostService contentPostService) {
        this.contentPostService = contentPostService;
    }

    @PostMapping
    public ResponseEntity<ContentPostDTO> createContentPost(@Valid @RequestBody ContentPostDTO dto) {
        Long userId = SecurityUtils.getCurrentUserId();
        ContentPostDTO created = contentPostService.createContentPost(userId, dto);
        return ResponseEntity.ok(created);
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<ContentPostDTO> updateStatus(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        Long userId = SecurityUtils.getCurrentUserId();
        String status = body.get("status");
        ContentPostDTO updated = contentPostService.updateStatus(userId, id, status);
        return ResponseEntity.ok(updated);
    }

    @GetMapping
    public ResponseEntity<List<ContentPostDTO>> getContentPosts() {
        Long userId = SecurityUtils.getCurrentUserId();
        List<ContentPostDTO> posts = contentPostService.getUserContentPosts(userId);
        return ResponseEntity.ok(posts);
    }
}
