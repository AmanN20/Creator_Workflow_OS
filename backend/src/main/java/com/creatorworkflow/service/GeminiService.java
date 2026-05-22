package com.creatorworkflow.service;

import com.creatorworkflow.exception.BadRequestException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.netty.channel.ChannelOption;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.netty.http.client.HttpClient;

import java.time.Duration;
import java.util.List;
import java.util.Map;

@Service
public class GeminiService {

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    @Value("${app.gemini.api-key}")
    private String apiKey;

    @Value("${app.gemini.analysis-api-key}")
    private String analysisApiKey;

    @Value("${app.gemini.model}")
    private String model;

    private static final int MAX_RETRIES = 2;
    private static final String[] FALLBACK_MODELS = {
        "gemini-2.0-flash",
        "gemini-1.5-flash"
    };

    public GeminiService(WebClient.Builder webClientBuilder, ObjectMapper objectMapper) {
        HttpClient httpClient = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 30_000)
                .responseTimeout(Duration.ofSeconds(120))
                .keepAlive(true);

        this.webClient = webClientBuilder
                .baseUrl("https://generativelanguage.googleapis.com")
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .build();
        this.objectMapper = objectMapper;
    }

    /**
     * Sends the parsed CSV summary to Gemini with retry + model fallback.
     * @param type "ideas" for next-video ideas only, "analysis" for full per-video analysis
     */
    public String analyzeWithGemini(String csvSummary, String type) {
        // Pick the right API key: analysis key for analysis, main key for ideas
        String activeKey = "analysis".equals(type) ? analysisApiKey : apiKey;
        if (activeKey == null || activeKey.isBlank() || activeKey.equals("YOUR_GEMINI_API_KEY")) {
            throw new BadRequestException("GEMINI_API_KEY is not configured. Set it in your .env file or environment variables.");
        }
        String prompt = "analysis".equals(type) ? buildPromptForAnalysis(csvSummary) : buildPromptForIdeas(csvSummary);

        // Build deduplicated model list: primary first, then fallbacks
        List<String> modelsToTry = new java.util.ArrayList<>();
        if (model != null && !model.isBlank()) modelsToTry.add(model);
        modelsToTry.addAll(java.util.Arrays.asList(FALLBACK_MODELS));
        modelsToTry = modelsToTry.stream().distinct().collect(java.util.stream.Collectors.toList());

        String lastRateLimitMsg = null;
        int rateLimitCount = 0;

        for (int i = 0; i < modelsToTry.size(); i++) {
            String currentModel = modelsToTry.get(i);
            try {
                return callGemini(currentModel, prompt, type, activeKey);
            } catch (BadRequestException e) {
                String msg = e.getMessage() != null ? e.getMessage() : "";

                if (msg.contains("404") || msg.contains("Not Found")) {
                    // Model not available on this API key — try next
                    continue;
                }

                if (msg.contains("429") || msg.contains("Too Many Requests") || msg.contains("RESOURCE_EXHAUSTED")) {
                    lastRateLimitMsg = msg;
                    rateLimitCount++;
                    // Backoff before trying next model: 5s, 10s, 20s
                    // Free tier is ~15 RPM — rapid switching burns the limit faster
                    if (i < modelsToTry.size() - 1) {
                        long backoffMs = (long) Math.pow(2, rateLimitCount) * 5000L;
                        try { Thread.sleep(backoffMs); } catch (InterruptedException ie) {
                            Thread.currentThread().interrupt();
                            throw new BadRequestException("Request interrupted");
                        }
                    }
                    continue;
                }

                if (msg.contains("503") || msg.contains("UNAVAILABLE") || msg.contains("high demand")) {
                    // Model overloaded — retry same model after short wait, then try next
                    rateLimitCount++;
                    if (rateLimitCount <= 2) {
                        // Retry same model once after 8s
                        try { Thread.sleep(8000); } catch (InterruptedException ie) {
                            Thread.currentThread().interrupt();
                            throw new BadRequestException("Request interrupted");
                        }
                        i--; // retry same model
                        continue;
                    }
                    lastRateLimitMsg = msg;
                    continue;
                }

                // Other error (auth, server error, etc.) — propagate immediately
                throw e;
            }
        }

        // Every model failed
        if (lastRateLimitMsg != null) {
            throw new BadRequestException(
                "All Gemini models exhausted. Last error: " + lastRateLimitMsg + "\n" +
                "Check your quota at https://aistudio.google.com/app/apikey"
            );
        }
        throw new BadRequestException("All Gemini models failed. Please verify your GEMINI_API_KEY is set correctly.");
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
                    return callGemini(currentModel, fullPrompt, null, apiKey);
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

    private String callGemini(String modelName, String prompt, String type, String activeKey) {
        // Analysis needs more tokens (detailed per-video breakdown); ideas needs less
        int maxTokens = "analysis".equals(type) ? 8192 : 6144;

        Map<String, Object> requestBody = Map.of(
            "contents", List.of(
                Map.of("parts", List.of(
                    Map.of("text", prompt)
                ))
            ),
            "generationConfig", Map.of(
                "temperature", 0.7,
                "maxOutputTokens", maxTokens
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
                .uri("/v1beta/models/{model}:generateContent?key={key}", modelName, activeKey)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(String.class)
                .timeout(Duration.ofSeconds(110))
                .block();

            return extractTextFromResponse(responseJson);

        } catch (Exception e) {
            // Reactor wraps TimeoutException — unwrap at any nesting depth
            Throwable cause = e;
            while (cause != null) {
                if (cause instanceof java.util.concurrent.TimeoutException) {
                    throw new BadRequestException("AI request timed out after 110 seconds. Please try again with a smaller CSV.");
                }
                cause = cause.getCause();
            }
            if (e instanceof WebClientResponseException wce) {
                String body = wce.getResponseBodyAsString();
                if (wce.getStatusCode().value() == 429 && body != null && !body.isBlank()) {
                    throw new BadRequestException(parse429Error(body));
                }
                String detail = body != null && !body.isBlank() ? " — " + body : "";
                throw new BadRequestException(wce.getStatusCode().value() + " " + wce.getStatusText() + detail);
            }
            throw new BadRequestException("Gemini request failed: " + e.getMessage());
        }
    }

    private String buildPromptForIdeas(String csvSummary) {
        return """
            You are a YouTube content strategist. Based on this channel's analytics data, generate exactly 10 specific, actionable video ideas for the creator's NEXT videos.

            %s

            Return ONLY valid JSON with this exact structure. Do not include any text outside the JSON. Do not use markdown code blocks.
            {
              "video_ideas": [
                {
                  "title": "Catchy, click-worthy video title",
                  "description": "1-2 sentences describing the video concept",
                  "why": "1 sentence explaining why this idea will perform well"
                }
              ]
            }

            CRITICAL RULES:
            - You MUST generate exactly 10 video ideas. Not 1, not 5 — exactly 10.
            - Keep each idea CONCISE: title (1 line), description (1-2 sentences), why (1 sentence).
            - Do NOT truncate. If you run out of space, make descriptions shorter but include all 10 ideas.
            - Each idea must be specific and actionable, not generic.
            - Base ideas on actual patterns from the data (top performers, audience behavior, content gaps).
            - Do NOT include summary, video_analyses, improved_titles, content_gaps, suggestions, or any other fields.
            - ONLY return the JSON object with the video_ideas array. Nothing else.
            """.formatted(csvSummary);
    }

    private String buildPromptForAnalysis(String csvSummary) {
        return """
            You are a YouTube growth analyst. Analyze this channel data and return ONLY valid JSON.
            Focus on the TOP 10 videos by views. Be concise.

            %s

            Return this exact JSON structure (no markdown, no text outside JSON):
            {
              "summary": {
                "total_videos": 0,
                "average_ctr": 0.0,
                "total_views": 0,
                "best_performing_video": "title here"
              },
              "video_analyses": [
                {
                  "original_title": "exact title",
                  "video_id": "echo [ID:xxx] if present, else null",
                  "metrics": {"views": 0, "ctr": 0.0, "watch_time_hours": 0.0},
                  "score": 75,
                  "metric_insights": "1-2 sentences on why this video performed this way.",
                  "improved_titles": [
                    {"improved": "Viral title 1", "reason": "hook reason"},
                    {"improved": "Viral title 2", "reason": "hook reason"}
                  ],
                  "content_gaps": [
                    {"gap": "Gap 1", "opportunity": "how to use it"},
                    {"gap": "Gap 2", "opportunity": "how to use it"}
                  ],
                  "suggestions": ["One specific actionable improvement for this video."]
                }
              ]
            }

            Rules:
            - Analyze only the top 10 videos shown.
            - Keep metric_insights to 1-2 sentences max.
            - Exactly 2 improved_titles, 2 content_gaps, 1 suggestion per video.
            - Be specific to each video's data, not generic.
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

    /**
     * Parses a Gemini 429 JSON body and returns a user-friendly message
     * indicating whether it's a daily or per-minute quota issue.
     */
    private String parse429Error(String body) {
        try {
            JsonNode root = objectMapper.readTree(body);
            JsonNode error = root.path("error");
            String message = error.path("message").asText("");

            boolean isDaily = message.contains("PerDay");
            String retryDelay = null;

            // Extract retryDelay from details array
            JsonNode details = error.path("details");
            if (details.isArray()) {
                for (JsonNode detail : details) {
                    if (detail.has("retryDelay")) {
                        retryDelay = detail.path("retryDelay").asText();
                        break;
                    }
                }
            }

            if (isDaily) {
                return "Your free-tier Gemini API daily quota is exhausted. " +
                       "It resets at midnight Pacific time. " +
                       "To avoid this, enable billing at https://ai.google.dev/gemini-api/docs/rate-limits";
            }

            String base = "Gemini API rate limit hit (free tier).";
            if (retryDelay != null && !retryDelay.isEmpty()) {
                base += " Retry after " + retryDelay + ".";
            }
            return base + " Enable billing for higher limits: https://ai.google.dev/gemini-api/docs/rate-limits";
        } catch (Exception e) {
            return "429 Too Many Requests — Gemini API rate limit exceeded. Check https://ai.google.dev/gemini-api/docs/rate-limits";
        }
    }

}
