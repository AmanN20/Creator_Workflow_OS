package com.creatorworkflow.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class ScriptRequest {
    @NotNull(message = "Idea ID is required")
    private Long ideaId;

    @NotBlank(message = "Prompt is required")
    private String prompt;

    private String tone;
    private String existingScript;

    public Long getIdeaId() { return ideaId; }
    public void setIdeaId(Long ideaId) { this.ideaId = ideaId; }
    public String getPrompt() { return prompt; }
    public void setPrompt(String prompt) { this.prompt = prompt; }
    public String getTone() { return tone; }
    public void setTone(String tone) { this.tone = tone; }
    public String getExistingScript() { return existingScript; }
    public void setExistingScript(String existingScript) { this.existingScript = existingScript; }
}
