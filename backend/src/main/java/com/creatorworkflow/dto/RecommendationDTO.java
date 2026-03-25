package com.creatorworkflow.dto;

import java.util.List;

public class RecommendationDTO {
    private String message;
    private List<String> suggestedTags;
    private String suggestedContentType;
    private int daysSinceLastPost;
    private String urgency;

    public RecommendationDTO() {}

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public List<String> getSuggestedTags() { return suggestedTags; }
    public void setSuggestedTags(List<String> suggestedTags) { this.suggestedTags = suggestedTags; }
    public String getSuggestedContentType() { return suggestedContentType; }
    public void setSuggestedContentType(String suggestedContentType) { this.suggestedContentType = suggestedContentType; }
    public int getDaysSinceLastPost() { return daysSinceLastPost; }
    public void setDaysSinceLastPost(int daysSinceLastPost) { this.daysSinceLastPost = daysSinceLastPost; }
    public String getUrgency() { return urgency; }
    public void setUrgency(String urgency) { this.urgency = urgency; }
}
