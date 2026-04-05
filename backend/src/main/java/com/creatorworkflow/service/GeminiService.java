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

    private static final int MAX_RETRIES = 3;
    private static final String[] FALLBACK_MODELS = {
        "gemini-2.5-flash",
        "gemini-2.0-flash",
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

        // Try primary model with retries, then fallback models
        Exception lastException = null;

        for (String currentModel : FALLBACK_MODELS) {
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
                        // Rate limited — wait with exponential backoff, then retry
                        long waitMs = (long) Math.pow(2, attempt) * 2000; // 4s, 8s, 16s
                        try {
                            Thread.sleep(waitMs);
                        } catch (InterruptedException ie) {
                            Thread.currentThread().interrupt();
                            throw new BadRequestException("Request interrupted during rate limit retry");
                        }
                        // If last retry for this model, try next model
                        if (attempt == MAX_RETRIES) {
                            break;
                        }
                    } else {
                        // Other error — still try next model
                        break;
                    }
                }
            }
        }

        // All retries exhausted — throw the exception instead of returning dummy data
        String errorMsg = lastException != null && lastException.getMessage() != null 
            ? lastException.getMessage() : "Unknown API Error";
        throw new BadRequestException("API Error: Rate Limit Exceeded or Quota Exhausted (" + errorMsg + "). Please wait a minute and try again.");
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
            Act as a YouTube growth expert and content strategist.
            
            Analyze the following YouTube channel analytics data carefully:
            
            %s
            
            Based on this data, provide your analysis STRICTLY in the following JSON format. 
            Do NOT include any text outside the JSON. Do NOT use markdown code blocks.
            Return ONLY valid JSON:
            
            {
              "video_ideas": [
                {"title": "...", "description": "...", "why": "..."}
              ],
              "title_hooks": [
                {"original": "...", "improved": "...", "reason": "..."}
              ],
              "content_gaps": [
                {"gap": "...", "opportunity": "...", "action": "..."}
              ],
              "growth_strategy": [
                {"strategy": "...", "implementation": "...", "expected_impact": "..."}
              ]
            }
            
            Requirements:
            - Generate exactly 10 viral video ideas based on patterns in the data
            - Suggest better titles for the worst-performing videos (up to 5)
            - Identify at least 3 content gaps
            - Provide at least 4 growth strategies
            - Be specific, actionable, and data-driven
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
