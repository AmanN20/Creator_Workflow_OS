package com.creatorworkflow.service;

import com.creatorworkflow.exception.BadRequestException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.util.List;
import java.util.Map;

@Service
public class GeminiService {

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    @Value("${app.gemini.api-key}")
    private String apiKey;

    @Value("${app.gemini.model}")
    private String model;

    private static final int MAX_RETRIES = 2;
    private static final String[] FALLBACK_MODELS = {
        "gemini-flash-latest",
        "gemini-2.5-flash",
        "gemini-2.0-flash-lite"
    };

    public GeminiService(WebClient.Builder webClientBuilder, ObjectMapper objectMapper) {
        this.webClient = webClientBuilder
                .baseUrl("https://generativelanguage.googleapis.com")
                .build();
        this.objectMapper = objectMapper;
    }

    /**
     * Sends the parsed CSV summary to Gemini with retry + model fallback.
     */
    public String analyzeWithGemini(String csvSummary) {
        String prompt = buildPrompt(csvSummary);

        // Build list of models to try (primary + fallbacks)
        List<String> modelsToTry = new java.util.ArrayList<>();
        if (model != null && !model.isBlank()) {
            modelsToTry.add(model);
        }
        modelsToTry.addAll(java.util.Arrays.asList(FALLBACK_MODELS));

        Exception lastException = null;

        for (String currentModel : modelsToTry) {
            for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                try {
                    return callGemini(currentModel, prompt);
                } catch (Exception e) {
                    lastException = e;
                    String msg = e.getMessage() != null ? e.getMessage() : "";

                    if (msg.contains("404") || msg.contains("Not Found")) {
                        // Model not available — skip to next model immediately
                        break;
                    } else if (msg.contains("429") || msg.contains("Too Many Requests") || msg.contains("RESOURCE_EXHAUSTED")) {
                        // Rate limited — wait, then retry
                        long waitMs = (long) Math.pow(2, attempt) * 4000; // 8s, 16s
                        try {
                            Thread.sleep(waitMs);
                        } catch (InterruptedException ie) {
                            Thread.currentThread().interrupt();
                            throw new BadRequestException("Request interrupted during rate limit retry");
                        }
                        // If rate limited even after retries, throw immediately. 
                        // Do not try fallback models because rate limits apply to the whole API key.
                        if (attempt == MAX_RETRIES) {
                            throw new BadRequestException("API Error: Rate Limit Exceeded or Quota Exhausted. Please wait a minute and try again.");
                        }
                    } else {
                        // Other error — still try next model
                        break;
                    }
                }
            }
        }

        // All retries exhausted
        String errorMsg = lastException != null && lastException.getMessage() != null 
            ? lastException.getMessage() : "Unknown API Error";
            
        throw new BadRequestException("API Error: " + errorMsg);
    }

    /**
     * General-purpose text analysis — used by the Script Editor side panel.
     */
    public String analyzeText(String text, String customPrompt) {
        String fullPrompt = customPrompt + "\n\n" + text;

        List<String> modelsToTry = new java.util.ArrayList<>();
        if (model != null && !model.isBlank()) modelsToTry.add(model);
        modelsToTry.addAll(java.util.Arrays.asList(FALLBACK_MODELS));

        Exception lastException = null;
        for (String currentModel : modelsToTry) {
            for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                try {
                    return callGemini(currentModel, fullPrompt);
                } catch (Exception e) {
                    lastException = e;
                    String msg = e.getMessage() != null ? e.getMessage() : "";
                    if (msg.contains("404") || msg.contains("Not Found")) break;
                    if (msg.contains("429") || msg.contains("RESOURCE_EXHAUSTED")) {
                        long waitMs = (long) Math.pow(2, attempt) * 4000;
                        try { Thread.sleep(waitMs); } catch (InterruptedException ie) {
                            Thread.currentThread().interrupt();
                            throw new BadRequestException("Request interrupted");
                        }
                        if (attempt == MAX_RETRIES) throw new BadRequestException("Rate limit exceeded. Wait and retry.");
                    } else break;
                }
            }
        }
        throw new BadRequestException("API Error: " + (lastException != null ? lastException.getMessage() : "Unknown"));
    }

    private String callGemini(String modelName, String prompt) {
        Map<String, Object> requestBody = Map.of(
            "contents", List.of(
                Map.of("parts", List.of(
                    Map.of("text", prompt)
                ))
            ),
            "generationConfig", Map.of(
                "temperature", 0.8,
                "maxOutputTokens", 32768
            ),
            "safetySettings", List.of(
                Map.of("category", "HARM_CATEGORY_HARASSMENT", "threshold", "BLOCK_NONE"),
                Map.of("category", "HARM_CATEGORY_HATE_SPEECH", "threshold", "BLOCK_NONE"),
                Map.of("category", "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold", "BLOCK_NONE"),
                Map.of("category", "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold", "BLOCK_NONE")
            )
        );

        try {
            String responseJson = webClient.post()
                .uri("/v1beta/models/{model}:generateContent?key={key}", modelName, apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(String.class)
                .block();

            return extractTextFromResponse(responseJson);

        } catch (WebClientResponseException e) {
            // Don't include URL (contains API key) in error message
            throw new BadRequestException(e.getStatusCode().value() + " " + e.getStatusText());
        }
    }

    private String buildPrompt(String csvSummary) {
        return """
            You are an elite YouTube growth strategist who has helped channels grow from 0 to 1M+ subscribers.
            Analyze this YouTube channel performance data and generate SPECIFIC, ACTIONABLE insights.
            
            %s
            
            Return ONLY valid JSON (no markdown, no text outside JSON).
            Use bold, YouTube-viral style titles similar to MrBeast, Dhruv Rathee, or Ali Abdaal.
            
            {
              "summary": {
                "total_videos": 0,
                "average_ctr": 0.0,
                "total_views": 0,
                "best_performing_video": "title"
              },
              "video_analyses": [
                {
                  "original_title": "exact title from data",
                  "video_id": "echo back the [ID:xxx] if present in the data, otherwise null",
                  "metrics": {"views": 0, "ctr": 0.0, "watch_time_hours": 0.0},
                  "score": 75,
                  "metric_insights": "2-3 lines explaining WHY this video performed this way. Discuss CTR psychology, retention patterns, and algorithm signals. Be specific, not generic.",
                  "improved_titles": [
                    {"improved": "Viral-style title 1", "reason": "Why this hook works"},
                    {"improved": "Viral-style title 2", "reason": "Psychological trigger used"},
                    {"improved": "Viral-style title 3", "reason": "Curiosity gap explanation"},
                    {"improved": "Viral-style title 4", "reason": "Emotional hook used"},
                    {"improved": "Viral-style title 5", "reason": "Urgency or FOMO element"}
                  ],
                  "content_gaps": [
                    {"gap": "Missing element 1", "opportunity": "How to exploit this gap"},
                    {"gap": "Missing element 2", "opportunity": "Specific angle to cover"},
                    {"gap": "Missing element 3", "opportunity": "Untapped audience segment"},
                    {"gap": "Missing element 4", "opportunity": "Content format opportunity"}
                  ],
                  "suggestions": [
                    "Actionable improvement 1 with specific steps",
                    "Actionable improvement 2 focusing on retention",
                    "Actionable improvement 3 for algorithm optimization"
                  ]
                }
              ]
            }
            
            CRITICAL RULES:
            - Include "summary" with aggregate stats.
            - Include "metrics" per video echoing back Views, CTR (as decimal), Watch Time.
            - Include "score" (0-100) per video based on overall performance.
            - If the data contains [ID:xxx], echo back the video_id value. Otherwise set video_id to null.
            - Analyze EVERY video. Do NOT skip any.
            - "metric_insights": 2-3 sentences of DEEP analysis. Why is CTR low/high? What does watch time indicate? How does the algorithm see this video?
            - "improved_titles": EXACTLY 5 viral-style titles per video using curiosity, emotion, urgency hooks.
            - "content_gaps": EXACTLY 4 specific gaps per video with exploitation strategies.
            - "suggestions": EXACTLY 3 actionable improvements per video.
            - Focus on CTR psychology, viewer retention, and content positioning.
            - NEVER give generic advice. Every insight must be specific to that video's data.
            """.formatted(csvSummary);
    }

    private String extractTextFromResponse(String responseJson) {
        try {
            JsonNode root = objectMapper.readTree(responseJson);
            JsonNode candidates = root.path("candidates");

            if (candidates.isArray() && !candidates.isEmpty()) {
                JsonNode content = candidates.get(0).path("content").path("parts");
                if (content.isArray() && !content.isEmpty()) {
                    StringBuilder fullText = new StringBuilder();
                    for (JsonNode part : content) {
                        if (part.has("text")) {
                            fullText.append(part.path("text").asText());
                        }
                    }
                    String text = fullText.toString().trim();
                    
                    // Robust JSON extraction
                    int startIndex = text.indexOf('{');
                    int endIndex = text.lastIndexOf('}');
                    
                    if (startIndex != -1 && endIndex != -1 && startIndex < endIndex) {
                        return text.substring(startIndex, endIndex + 1);
                    }
                    
                    // Fallback to original text if no braces found
                    return text;
                }
            }

            JsonNode error = root.path("error");
            if (!error.isMissingNode()) {
                String errMsg = error.path("message").asText();
                if (errMsg.contains("RESOURCE_EXHAUSTED") || errMsg.contains("quota")) {
                    throw new BadRequestException("429 RESOURCE_EXHAUSTED");
                }
                throw new BadRequestException("Gemini API error: " + errMsg);
            }

            throw new BadRequestException("Empty response from Gemini API");

        } catch (BadRequestException e) {
            throw e;
        } catch (Exception e) {
            throw new BadRequestException("Failed to parse Gemini response: " + e.getMessage());
        }
    }

}
