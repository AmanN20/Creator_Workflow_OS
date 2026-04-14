package com.creatorworkflow.controller;

import com.creatorworkflow.dto.ScriptDTO;
import com.creatorworkflow.dto.ScriptRequest;
import com.creatorworkflow.service.GeminiService;
import com.creatorworkflow.service.ResearchService;
import com.creatorworkflow.service.ScriptService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/script")
public class ScriptController {

    private final ScriptService scriptService;
    private final GeminiService geminiService;
    private final ResearchService researchService;

    public ScriptController(ScriptService scriptService, GeminiService geminiService, ResearchService researchService) {
        this.scriptService = scriptService;
        this.geminiService = geminiService;
        this.researchService = researchService;
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

    @PostMapping("/save")
    public ResponseEntity<ScriptDTO> saveManualScript(@Valid @RequestBody ScriptRequest request) {
        ScriptDTO result = scriptService.saveManualScript(request);
        return ResponseEntity.ok(result);
    }

    @PutMapping("/{id}/canvas")
    public ResponseEntity<ScriptDTO> updateCanvas(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String canvasData = body.get("canvasData");
        ScriptDTO result = scriptService.updateScriptCanvas(id, canvasData);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/analyze")
    public ResponseEntity<Map<String, String>> analyzeScript(@RequestBody Map<String, String> body) {
        String scriptText = body.getOrDefault("text", "");
        if (scriptText.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Script text is empty"));
        }
        String prompt = """
            Analyze the following video script and return ONLY valid JSON (no markdown):
            {
              "summary": "2-3 sentence summary of the script",
              "tone": "e.g. Educational, Storytelling, Conversational, Dramatic, etc.",
              "target_audience": "Who this script is best suited for",
              "key_topics": ["topic1", "topic2", "topic3"],
              "strengths": ["strength1", "strength2"],
              "suggestions": [
                "Specific actionable improvement 1",
                "Specific actionable improvement 2",
                "Specific actionable improvement 3"
              ],
              "hook_ideas": [
                "Alternative opening hook 1",
                "Alternative opening hook 2"
              ],
              "estimated_duration": "Estimated video length based on word count"
            }
            Be specific and strategic. Tailor to YouTube content.
            """;
        String result = geminiService.analyzeText(scriptText, prompt);
        return ResponseEntity.ok(Map.of("analysis", result));
    }
    @PostMapping("/research")
    public ResponseEntity<Map<String, Object>> researchScript(@RequestBody Map<String, String> body) {
        String scriptText = body.getOrDefault("text", "");
        if (scriptText.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Script text is empty"));
        }
        Map<String, Object> result = researchService.research(scriptText);
        return ResponseEntity.ok(result);
    }
}
