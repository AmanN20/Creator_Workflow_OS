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

    private String callGemini(String modelName, String prompt) {
        Map<String, Object> requestBody = Map.of(
            "contents", List.of(
                Map.of("parts", List.of(
                    Map.of("text", prompt)
                ))
            ),
            "generationConfig", Map.of(
                "temperature", 0.8,
                "maxOutputTokens", 8192
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
            Act as an elite YouTube growth expert and content strategist.
            
            Analyze the following YouTube channel analytics data carefully:
            
            %s
            
            Based on this data, provide a heavily detailed, comprehensive per-video breakdown STRICTLY in the following JSON format. 
            Do NOT include any text outside the JSON. Do NOT use markdown code blocks.
            Return ONLY valid JSON:
            
            {
              "video_analyses": [
                {
                  "original_title": "...",
                  "metric_insights": "Extremely detailed, multi-sentence insight breaking down exactly why this video performed the way it did based on its Views, CTR, Watch Time, Avg View Duration, and Likes. Discuss viewer psychology and algorithm impact.",
                  "improved_titles": [
                    {"improved": "...", "reason": "Detailed explanation of the psychological hook and why it would improve CTR."}
                  ],
                  "content_gaps": [
                    {"gap": "...", "opportunity": "Extremely descriptive explanation of how this gap can be exploited, including potential angles and viewer value."}
                  ]
                }
              ]
            }
            
            CRITICAL REQUIREMENTS:
            - Analyze EVERY SINGLE VIDEO provided in the data. Do NOT skip any videos. Do not limit to 10.
            - "metric_insights": Must be at least 3-5 sentences of deep, analytical reasoning. Don't just restate the numbers; tell me WHAT the numbers mean for audience retention and algorithm discovery.
            - "improved_titles": Provide 3 powerful, highly-clickable titles for each video, with deep reasoning on the psychological hooks used.
            - "content_gaps": Provide 2-3 specific content gaps for each video. The descriptions must be highly descriptive, explaining exactly how to execute the follow-up video for maximum views.
            - Be as descriptive and comprehensive as possible.
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
