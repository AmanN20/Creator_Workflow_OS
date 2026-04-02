package com.creatorworkflow.controller;

import com.creatorworkflow.dto.IdeaDTO;
import com.creatorworkflow.security.SecurityUtils;
import com.creatorworkflow.service.IdeaService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/ideas")
public class IdeaController {

    private final IdeaService ideaService;

    public IdeaController(IdeaService ideaService) {
        this.ideaService = ideaService;
    }

    // Original manual create
    @PostMapping
    public ResponseEntity<IdeaDTO> createIdea(@Valid @RequestBody IdeaDTO ideaDTO) {
        Long userId = SecurityUtils.getCurrentUserId();
        IdeaDTO created = ideaService.createIdea(userId, ideaDTO);
        return ResponseEntity.ok(created);
    }

    // NEW: Explicit manual create endpoint
    @PostMapping("/manual")
    public ResponseEntity<IdeaDTO> createManualIdea(@Valid @RequestBody IdeaDTO ideaDTO) {
        Long userId = SecurityUtils.getCurrentUserId();
        IdeaDTO created = ideaService.createIdea(userId, ideaDTO);
        return ResponseEntity.ok(created);
    }

    // NEW: CSV upload endpoint
    @PostMapping(value = "/upload-csv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<IdeaDTO> uploadCsv(@RequestParam("file") MultipartFile file) {
        Long userId = SecurityUtils.getCurrentUserId();
        IdeaDTO result = ideaService.processCSVUpload(userId, file);
        return ResponseEntity.ok(result);
    }

    @GetMapping
    public ResponseEntity<List<IdeaDTO>> getIdeas(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String tag) {
        Long userId = SecurityUtils.getCurrentUserId();
        List<IdeaDTO> ideas = ideaService.getUserIdeas(userId, search, tag);
        return ResponseEntity.ok(ideas);
    }

    @GetMapping("/{id}")
    public ResponseEntity<IdeaDTO> getIdea(@PathVariable Long id) {
        Long userId = SecurityUtils.getCurrentUserId();
        IdeaDTO idea = ideaService.getIdeaById(userId, id);
        return ResponseEntity.ok(idea);
    }

    @PutMapping("/{id}")
    public ResponseEntity<IdeaDTO> updateIdea(@PathVariable Long id, @Valid @RequestBody IdeaDTO ideaDTO) {
        Long userId = SecurityUtils.getCurrentUserId();
        IdeaDTO updated = ideaService.updateIdea(userId, id, ideaDTO);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteIdea(@PathVariable Long id) {
        Long userId = SecurityUtils.getCurrentUserId();
        ideaService.deleteIdea(userId, id);
        return ResponseEntity.noContent().build();
    }
}
