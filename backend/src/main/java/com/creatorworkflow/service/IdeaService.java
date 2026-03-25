package com.creatorworkflow.service;

import com.creatorworkflow.dto.IdeaDTO;
import com.creatorworkflow.entity.Idea;
import com.creatorworkflow.exception.ResourceNotFoundException;
import com.creatorworkflow.repository.IdeaRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class IdeaService {

    private final IdeaRepository ideaRepository;

    public IdeaService(IdeaRepository ideaRepository) {
        this.ideaRepository = ideaRepository;
    }

    public IdeaDTO createIdea(Long userId, IdeaDTO dto) {
        Idea idea = new Idea();
        idea.setUserId(userId);
        idea.setTitle(dto.getTitle());
        idea.setDescription(dto.getDescription());
        idea.setTags(dto.getTags());

        Idea saved = ideaRepository.save(idea);
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
        return new IdeaDTO(idea.getId(), idea.getTitle(), idea.getDescription(),
                idea.getTags(), idea.getCreatedAt());
    }
}
