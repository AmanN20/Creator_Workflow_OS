package com.creatorworkflow.dto;

import jakarta.validation.constraints.NotBlank;
import java.time.LocalDateTime;

public class ContentPostDTO {
    private Long id;

    @NotBlank(message = "Title is required")
    private String title;

    private Long ideaId;
    private String status;
    private LocalDateTime scheduledAt;
    private LocalDateTime updatedAt;
    private LocalDateTime createdAt;

    public ContentPostDTO() {}

    public ContentPostDTO(Long id, String title, Long ideaId, String status,
                          LocalDateTime scheduledAt, LocalDateTime updatedAt, LocalDateTime createdAt) {
        this.id = id;
        this.title = title;
        this.ideaId = ideaId;
        this.status = status;
        this.scheduledAt = scheduledAt;
        this.updatedAt = updatedAt;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public Long getIdeaId() { return ideaId; }
    public void setIdeaId(Long ideaId) { this.ideaId = ideaId; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getScheduledAt() { return scheduledAt; }
    public void setScheduledAt(LocalDateTime scheduledAt) { this.scheduledAt = scheduledAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
