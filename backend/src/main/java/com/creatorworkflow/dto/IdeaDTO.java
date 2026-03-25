package com.creatorworkflow.dto;

import jakarta.validation.constraints.NotBlank;
import java.time.LocalDateTime;

public class IdeaDTO {
    private Long id;

    @NotBlank(message = "Title is required")
    private String title;

    private String description;
    private String tags;
    private LocalDateTime createdAt;

    public IdeaDTO() {}

    public IdeaDTO(Long id, String title, String description, String tags, LocalDateTime createdAt) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.tags = tags;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getTags() { return tags; }
    public void setTags(String tags) { this.tags = tags; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
