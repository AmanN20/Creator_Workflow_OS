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
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
        "gemini-1.5-pro"
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

        // All retries exhausted — return a structured fallback response
        return generateFallbackResponse(csvSummary);
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
                "maxOutputTokens", 4096
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
                    String text = content.get(0).path("text").asText();
                    text = text.trim();
                    if (text.startsWith("```json")) {
                        text = text.substring(7);
                    } else if (text.startsWith("```")) {
                        text = text.substring(3);
                    }
                    if (text.endsWith("```")) {
                        text = text.substring(0, text.length() - 3);
                    }
                    return text.trim();
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
     * Generates a structured fallback when all Gemini models are rate-limited.
     */
    private String generateFallbackResponse(String csvSummary) {
        return """
            {
              "video_ideas": [
                {"title": "Behind the Scenes of My Content Process", "description": "Show your audience how you create content from ideation to publishing", "why": "BTS content builds trust and typically gets 2x more engagement"},
                {"title": "I Analyzed My YouTube Analytics — Here's What I Found", "description": "Share real data insights with your audience in a transparent format", "why": "Data-driven content positions you as an authority"},
                {"title": "Top 5 Mistakes I Made as a Creator", "description": "Honest reflection on lessons learned from your channel journey", "why": "Vulnerability and honesty drive relatability"},
                {"title": "Reacting to My First vs Latest Video", "description": "Compare your growth over time — audiences love transformation arcs", "why": "Nostalgia + growth = highly shareable content"},
                {"title": "The One Strategy That Doubled My Views", "description": "Deep dive into your most effective growth tactic", "why": "Actionable single-strategy videos convert viewers to subscribers"}
              ],
              "title_hooks": [
                {"original": "My Video", "improved": "I Tried This for 30 Days — The Results Shocked Me", "reason": "Curiosity gap + timeframe creates urgency"},
                {"original": "Tips for Growth", "improved": "5 Growth Hacks YouTube Gurus Won't Tell You", "reason": "Contrarian angle + specific number increases CTR"}
              ],
              "content_gaps": [
                {"gap": "No short-form content strategy", "opportunity": "Shorts/Reels can drive 3-5x more impressions to your channel", "action": "Create 2-3 Shorts per week from existing long-form content"},
                {"gap": "Limited audience interaction content", "opportunity": "Q&A and community-driven videos boost retention by 40%%", "action": "Run monthly Q&A sessions or community polls"},
                {"gap": "No collaboration content", "opportunity": "Collabs expose you to new audiences at zero cost", "action": "Reach out to 3 creators in your niche for cross-promotion"}
              ],
              "growth_strategy": [
                {"strategy": "Thumbnail A/B Testing", "implementation": "Create 2 thumbnail variants for every video and swap after 48 hours based on CTR", "expected_impact": "15-30%% increase in click-through rate"},
                {"strategy": "Content Batching", "implementation": "Dedicate 2 days per week for filming multiple videos to maintain consistency", "expected_impact": "More consistent upload schedule leading to algorithmic favor"},
                {"strategy": "SEO Optimization", "implementation": "Research keywords using YouTube search suggestions and include them in titles, descriptions, and tags", "expected_impact": "20-50%% increase in organic search traffic"},
                {"strategy": "Community Engagement", "implementation": "Reply to every comment in the first 2 hours after publishing and pin a discussion question", "expected_impact": "Higher engagement signals boost video distribution"}
              ]
            }
            """;
    }
}
