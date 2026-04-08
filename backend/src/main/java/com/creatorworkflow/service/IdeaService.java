package com.creatorworkflow.service;

import com.creatorworkflow.dto.IdeaDTO;
import com.creatorworkflow.entity.Idea;
import com.creatorworkflow.entity.ContentPost;
import com.creatorworkflow.exception.ResourceNotFoundException;
import com.creatorworkflow.repository.ContentPostRepository;
import com.creatorworkflow.repository.IdeaRepository;
import com.creatorworkflow.repository.ScriptRepository;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.transaction.annotation.Transactional;

@Service
public class IdeaService {

    private final IdeaRepository ideaRepository;
    private final ContentPostRepository contentPostRepository;
    private final ScriptRepository scriptRepository;
    private final CsvParserService csvParserService;
    private final GeminiService geminiService;

    public IdeaService(IdeaRepository ideaRepository,
                       ContentPostRepository contentPostRepository,
                       ScriptRepository scriptRepository,
                       CsvParserService csvParserService,
                       GeminiService geminiService) {
        this.ideaRepository = ideaRepository;
        this.contentPostRepository = contentPostRepository;
        this.scriptRepository = scriptRepository;
        this.csvParserService = csvParserService;
        this.geminiService = geminiService;
    }

    /**
     * Creates a manual idea (original behavior preserved).
     */
    public IdeaDTO createIdea(Long userId, IdeaDTO dto) {
        Idea idea = new Idea();
        idea.setUserId(userId);
        idea.setTitle(dto.getTitle());
        idea.setDescription(dto.getDescription());
        idea.setTags(dto.getTags());
        idea.setType("manual");
        idea.setInputData(dto.getDescription());

        Idea saved = ideaRepository.save(idea);

        // Auto-create a ContentPost so the workflow dashboard populates
        ContentPost post = new ContentPost();
        post.setUserId(userId);
        post.setIdeaId(saved.getId());
        post.setTitle(saved.getTitle());
        post.setStatus("IDEA");
        contentPostRepository.save(post);

        return toDTO(saved);
    }

    /**
     * Processes a YouTube CSV upload:
     * 1. Parse CSV
     * 2. Extract key metrics
     * 3. Send to Gemini for AI analysis
     * 4. Store everything in the database
     */
    public IdeaDTO processCSVUpload(Long userId, MultipartFile file) {
        // 1. Parse CSV
        Map<String, Object> parsedData = csvParserService.parseCsv(file);
        String summary = (String) parsedData.get("summary");

        // 2. Send to Gemini
        String aiResponse = geminiService.analyzeWithGemini(summary);

        // 3. Save to DB so Content Analysis page can retrieve it
        Idea idea = new Idea();
        idea.setUserId(userId);
        idea.setTitle("AI Analysis: YouTube CSV (" + parsedData.get("totalVideos") + " videos)");
        idea.setDescription("AI-generated analysis from YouTube Studio CSV export");
        idea.setTags("YouTube, AI-Generated");
        idea.setType("ai_csv");
        idea.setInputData(summary);
        idea.setOutputData(aiResponse);

        Idea saved = ideaRepository.save(idea);
        return toDTO(saved);
    }

    /**
     * Returns only ai_csv type ideas for the Content Analysis page.
     */
    public List<IdeaDTO> getUserAnalyses(Long userId) {
        return ideaRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .filter(idea -> "ai_csv".equals(idea.getType()))
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public List<IdeaDTO> getUserIdeas(Long userId, String search, String tag) {
        List<Idea> ideas;

        if (search != null && !search.isBlank()) {
            ideas = ideaRepository.searchByUserIdAndKeyword(userId, search);
        } else if (tag != null && !tag.isBlank()) {
            ideas = ideaRepository.findByUserIdAndTag(userId, tag);
        } else {
            ideas = ideaRepository.findByUserIdOrderByCreatedAtDesc(userId);
        }

        // Filter out ai_csv ideas — those are shown on Content Analysis page instead
        return ideas.stream()
                .filter(idea -> !"ai_csv".equals(idea.getType()))
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public IdeaDTO updateIdea(Long userId, Long ideaId, IdeaDTO dto) {
        Idea idea = ideaRepository.findById(ideaId)
                .orElseThrow(() -> new ResourceNotFoundException("Idea not found with id: " + ideaId));

        if (!idea.getUserId().equals(userId)) {
            throw new ResourceNotFoundException("Idea not found");
        }

        idea.setTitle(dto.getTitle());
        idea.setDescription(dto.getDescription());
        idea.setTags(dto.getTags());

        Idea updated = ideaRepository.save(idea);
        return toDTO(updated);
    }

    @Transactional
    public void deleteIdea(Long userId, Long ideaId) {
        Idea idea = ideaRepository.findById(ideaId)
                .orElseThrow(() -> new ResourceNotFoundException("Idea not found with id: " + ideaId));

        if (!idea.getUserId().equals(userId)) {
            throw new ResourceNotFoundException("Idea not found");
        }

        // 1. Delete all scripts for this idea
        scriptRepository.deleteByIdeaId(ideaId);

        // 2. Delete associated ContentPosts
        contentPostRepository.deleteAll(contentPostRepository.findByIdeaId(ideaId));

        // 3. Finally delete the Idea
        ideaRepository.delete(idea);
    }

    public IdeaDTO getIdeaById(Long userId, Long ideaId) {
        Idea idea = ideaRepository.findById(ideaId)
                .orElseThrow(() -> new ResourceNotFoundException("Idea not found with id: " + ideaId));

        if (!idea.getUserId().equals(userId)) {
            throw new ResourceNotFoundException("Idea not found");
        }

        return toDTO(idea);
    }

    private IdeaDTO toDTO(Idea idea) {
        return new IdeaDTO(
            idea.getId(),
            idea.getTitle(),
            idea.getDescription(),
            idea.getTags(),
            idea.getType(),
            idea.getInputData(),
            idea.getOutputData(),
            idea.getCreatedAt()
        );
    }
}
