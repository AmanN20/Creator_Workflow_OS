package com.creatorworkflow.service;

import com.creatorworkflow.dto.IdeaDTO;
import com.creatorworkflow.entity.Idea;
import com.creatorworkflow.entity.ContentPost;
import com.creatorworkflow.exception.ResourceNotFoundException;
import com.creatorworkflow.repository.ContentPostRepository;
import com.creatorworkflow.repository.IdeaRepository;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class IdeaService {

    private final IdeaRepository ideaRepository;
    private final ContentPostRepository contentPostRepository;
    private final CsvParserService csvParserService;
    private final GeminiService geminiService;

    public IdeaService(IdeaRepository ideaRepository,
                       ContentPostRepository contentPostRepository,
                       CsvParserService csvParserService,
                       GeminiService geminiService) {
        this.ideaRepository = ideaRepository;
        this.contentPostRepository = contentPostRepository;
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

        // 3. Create and save the idea
        Idea idea = new Idea();
        idea.setUserId(userId);
        idea.setTitle("AI Analysis: YouTube CSV (" + parsedData.get("totalVideos") + " videos)");
        idea.setDescription("AI-generated analysis from YouTube Studio CSV export");
        idea.setTags("YouTube, AI-Generated");
        idea.setType("ai_csv");
        idea.setInputData(summary);
        idea.setOutputData(aiResponse);

        Idea saved = ideaRepository.save(idea);

        // Auto-create a ContentPost for the CSV idea
        ContentPost post = new ContentPost();
        post.setUserId(userId);
        post.setIdeaId(saved.getId());
        post.setTitle(saved.getTitle());
        post.setStatus("IDEA");
        contentPostRepository.save(post);

        return toDTO(saved);
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

        return ideas.stream().map(this::toDTO).collect(Collectors.toList());
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

    public void deleteIdea(Long userId, Long ideaId) {
        Idea idea = ideaRepository.findById(ideaId)
                .orElseThrow(() -> new ResourceNotFoundException("Idea not found with id: " + ideaId));

        if (!idea.getUserId().equals(userId)) {
            throw new ResourceNotFoundException("Idea not found");
        }

        ideaRepository.delete(idea);

        // Associated ContentPost will be deleted cascade automatically if FK exists, or we can manually delete it (FK is ON DELETE SET NULL currently).
        // Since FK is SET NULL, let's delete the content post explicitly
        contentPostRepository.findByUserId(userId).stream()
                .filter(p -> ideaId.equals(p.getIdeaId()))
                .forEach(contentPostRepository::delete);
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
