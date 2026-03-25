package com.creatorworkflow.service;

import com.creatorworkflow.dto.ScriptDTO;
import com.creatorworkflow.dto.ScriptRequest;
import com.creatorworkflow.entity.Script;
import com.creatorworkflow.exception.ResourceNotFoundException;
import com.creatorworkflow.repository.IdeaRepository;
import com.creatorworkflow.repository.ScriptRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class ScriptService {

    private final ScriptRepository scriptRepository;
    private final IdeaRepository ideaRepository;
    private final WebClient webClient;
    private final String aiModel;

    public ScriptService(ScriptRepository scriptRepository,
                         IdeaRepository ideaRepository,
                         @Value("${app.ai.api-url}") String apiUrl,
                         @Value("${app.ai.api-key}") String apiKey,
                         @Value("${app.ai.model}") String aiModel) {
        this.scriptRepository = scriptRepository;
        this.ideaRepository = ideaRepository;
        this.aiModel = aiModel;
        this.webClient = WebClient.builder()
                .baseUrl(apiUrl)
                .defaultHeader("Authorization", "Bearer " + apiKey)
                .defaultHeader("Content-Type", "application/json")
                .build();
    }

    public ScriptDTO generateScript(ScriptRequest request) {
        ideaRepository.findById(request.getIdeaId())
                .orElseThrow(() -> new ResourceNotFoundException("Idea not found"));

        String tone = request.getTone() != null ? request.getTone() : "professional";

        String systemPrompt = "You are an expert content script writer. Generate a well-structured script with three clear sections: " +
                "HOOK (attention-grabbing opening), BODY (main content with key points), and CALL-TO-ACTION (engagement prompt). " +
                "Use a " + tone + " tone. Format each section clearly with headers.";

        String userPrompt = "Create a content script based on this idea: " + request.getPrompt();

        String content = callAI(systemPrompt, userPrompt);

        Script script = new Script();
        script.setIdeaId(request.getIdeaId());
        script.setContent(content);
        script.setScriptType("GENERATED");

        Script saved = scriptRepository.save(script);
        return toDTO(saved);
    }

    public ScriptDTO improveScript(ScriptRequest request) {
        if (request.getExistingScript() == null || request.getExistingScript().isBlank()) {
            throw new ResourceNotFoundException("Existing script content is required for improvement");
        }

        String tone = request.getTone() != null ? request.getTone() : "professional";

        String systemPrompt = "You are an expert content editor. Improve the provided script while maintaining its core message. " +
                "Enhance the hook, strengthen the body with better transitions and examples, and make the call-to-action more compelling. " +
                "Use a " + tone + " tone. Keep the HOOK, BODY, CALL-TO-ACTION structure.";

        String userPrompt = "Improve this script: \n\n" + request.getExistingScript() +
                "\n\nAdditional instructions: " + request.getPrompt();

        String content = callAI(systemPrompt, userPrompt);

        Script script = new Script();
        script.setIdeaId(request.getIdeaId());
        script.setContent(content);
        script.setScriptType("IMPROVED");

        Script saved = scriptRepository.save(script);
        return toDTO(saved);
    }

    public ScriptDTO generateHook(ScriptRequest request) {
        String systemPrompt = "You are a hook specialist for social media content. Generate 5 attention-grabbing hooks " +
                "for the given idea. Each hook should be a different style: " +
                "1. Question hook, 2. Shocking stat hook, 3. Story hook, 4. Controversial take hook, 5. Curiosity gap hook. " +
                "Number each hook and make them concise and powerful.";

        String userPrompt = "Generate hooks for this content idea: " + request.getPrompt();

        String content = callAI(systemPrompt, userPrompt);

        Script script = new Script();
        script.setIdeaId(request.getIdeaId());
        script.setContent(content);
        script.setScriptType("HOOKS");

        Script saved = scriptRepository.save(script);
        return toDTO(saved);
    }

    public List<ScriptDTO> getScriptsByIdea(Long ideaId) {
        return scriptRepository.findByIdeaIdOrderByCreatedAtDesc(ideaId)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    private String callAI(String systemPrompt, String userPrompt) {
        try {
            Map<String, Object> requestBody = Map.of(
                    "model", aiModel,
                    "messages", List.of(
                            Map.of("role", "system", "content", systemPrompt),
                            Map.of("role", "user", "content", userPrompt)
                    ),
                    "temperature", 0.7,
                    "max_tokens", 2000
            );

            Map<?, ?> response = webClient.post()
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (response != null && response.containsKey("choices")) {
                List<?> choices = (List<?>) response.get("choices");
                if (!choices.isEmpty()) {
                    Map<?, ?> choice = (Map<?, ?>) choices.get(0);
                    Map<?, ?> message = (Map<?, ?>) choice.get("message");
                    return (String) message.get("content");
                }
            }

            return generateFallbackScript(userPrompt);

        } catch (Exception e) {
            return generateFallbackScript(userPrompt);
        }
    }

    private String generateFallbackScript(String idea) {
        return "## HOOK\n\n" +
                "Have you ever wondered about " + idea + "? What if I told you there's something most people completely miss?\n\n" +
                "## BODY\n\n" +
                "Let me break this down for you.\n\n" +
                "**Point 1:** " + idea + " is transforming how we think about content creation. " +
                "The key insight is that authenticity always wins over perfection.\n\n" +
                "**Point 2:** Studies show that creators who focus on value-driven content see 3x more engagement. " +
                "Here's the framework you can use:\n" +
                "- Start with your unique perspective\n" +
                "- Add practical examples your audience can relate to\n" +
                "- End each section with a takeaway\n\n" +
                "**Point 3:** The biggest mistake? Overthinking it. " +
                "The best content comes from genuine experiences and real insights.\n\n" +
                "## CALL-TO-ACTION\n\n" +
                "If this resonated with you, save this post for later and share it with a fellow creator! " +
                "Drop a comment below — what's YOUR take on " + idea + "? " +
                "Follow for more content creation tips every week! 🚀";
    }

    private ScriptDTO toDTO(Script script) {
        return new ScriptDTO(script.getId(), script.getIdeaId(), script.getContent(),
                script.getScriptType(), script.getCreatedAt());
    }
}
