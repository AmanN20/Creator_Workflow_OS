package com.creatorworkflow.dto;

import java.util.Map;

public class AnalyticsDTO {
    private long totalIdeas;
    private long totalPosts;
    private long completedPosts;
    private Map<String, Long> statusBreakdown;
    private Map<String, Long> weeklyActivity;

    public AnalyticsDTO() {}

    public long getTotalIdeas() { return totalIdeas; }
    public void setTotalIdeas(long totalIdeas) { this.totalIdeas = totalIdeas; }
    public long getTotalPosts() { return totalPosts; }
    public void setTotalPosts(long totalPosts) { this.totalPosts = totalPosts; }
    public long getCompletedPosts() { return completedPosts; }
    public void setCompletedPosts(long completedPosts) { this.completedPosts = completedPosts; }
    public Map<String, Long> getStatusBreakdown() { return statusBreakdown; }
    public void setStatusBreakdown(Map<String, Long> statusBreakdown) { this.statusBreakdown = statusBreakdown; }
    public Map<String, Long> getWeeklyActivity() { return weeklyActivity; }
    public void setWeeklyActivity(Map<String, Long> weeklyActivity) { this.weeklyActivity = weeklyActivity; }
}
