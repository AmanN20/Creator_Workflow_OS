package com.creatorworkflow.controller;

import com.creatorworkflow.dto.ScriptDTO;
import com.creatorworkflow.dto.ScriptRequest;
import com.creatorworkflow.service.ScriptService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/script")
public class ScriptController {

    private final ScriptService scriptService;

    public ScriptController(ScriptService scriptService) {
        this.scriptService = scriptService;
    }

    @PostMapping("/generate")
    public ResponseEntity<ScriptDTO> generateScript(@Valid @RequestBody ScriptRequest request) {
        ScriptDTO result = scriptService.generateScript(request);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/improve")
    public ResponseEntity<ScriptDTO> improveScript(@Valid @RequestBody ScriptRequest request) {
        ScriptDTO result = scriptService.improveScript(request);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/hook")
    public ResponseEntity<ScriptDTO> generateHook(@Valid @RequestBody ScriptRequest request) {
        ScriptDTO result = scriptService.generateHook(request);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/idea/{ideaId}")
    public ResponseEntity<List<ScriptDTO>> getScriptsByIdea(@PathVariable Long ideaId) {
        List<ScriptDTO> scripts = scriptService.getScriptsByIdea(ideaId);
        return ResponseEntity.ok(scripts);
    }
}
