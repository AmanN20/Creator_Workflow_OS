package com.creatorworkflow.dto;

import java.util.List;
import java.util.Map;

public class CsvIdeaResponse {

    private String summary;
    private List<Map<String, String>> topPerformers;
    private List<Map<String, String>> lowCtrVideos;
    private List<Map<String, String>> highRetention;
    private String aiAnalysis; // raw JSON string from Gemini

    public CsvIdeaResponse() {}

    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }

    public List<Map<String, String>> getTopPerformers() { return topPerformers; }
    public void setTopPerformers(List<Map<String, String>> topPerformers) { this.topPerformers = topPerformers; }

    public List<Map<String, String>> getLowCtrVideos() { return lowCtrVideos; }
    public void setLowCtrVideos(List<Map<String, String>> lowCtrVideos) { this.lowCtrVideos = lowCtrVideos; }

    public List<Map<String, String>> getHighRetention() { return highRetention; }
    public void setHighRetention(List<Map<String, String>> highRetention) { this.highRetention = highRetention; }

    public String getAiAnalysis() { return aiAnalysis; }
    public void setAiAnalysis(String aiAnalysis) { this.aiAnalysis = aiAnalysis; }
}
