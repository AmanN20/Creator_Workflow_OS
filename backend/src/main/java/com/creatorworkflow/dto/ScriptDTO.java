package com.creatorworkflow.dto;

import java.time.LocalDateTime;

public class ScriptDTO {
    private Long id;
    private Long ideaId;
    private String content;
    private String scriptType;
    private LocalDateTime createdAt;

    public ScriptDTO() {}

    public ScriptDTO(Long id, Long ideaId, String content, String scriptType, LocalDateTime createdAt) {
        this.id = id;
        this.ideaId = ideaId;
        this.content = content;
        this.scriptType = scriptType;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getIdeaId() { return ideaId; }
    public void setIdeaId(Long ideaId) { this.ideaId = ideaId; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getScriptType() { return scriptType; }
    public void setScriptType(String scriptType) { this.scriptType = scriptType; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
