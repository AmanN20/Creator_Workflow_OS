package com.creatorworkflow.service;

import com.creatorworkflow.dto.ContentPostDTO;
import com.creatorworkflow.entity.ContentPost;
import com.creatorworkflow.exception.BadRequestException;
import com.creatorworkflow.exception.ResourceNotFoundException;
import com.creatorworkflow.repository.ContentPostRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ContentPostService {

    private static final List<String> VALID_STATUSES = Arrays.asList(
            "IDEA", "SCRIPT", "RECORDED", "EDITED", "POSTED"
    );

    private final ContentPostRepository contentPostRepository;

    public ContentPostService(ContentPostRepository contentPostRepository) {
        this.contentPostRepository = contentPostRepository;
    }

    public ContentPostDTO createContentPost(Long userId, ContentPostDTO dto) {
        ContentPost post = new ContentPost();
        post.setUserId(userId);
        post.setTitle(dto.getTitle());
        post.setIdeaId(dto.getIdeaId());
        post.setStatus(dto.getStatus() != null ? dto.getStatus() : "IDEA");

        if (dto.getScheduledAt() != null) {
            post.setScheduledAt(dto.getScheduledAt());
        }

        ContentPost saved = contentPostRepository.save(post);
        return toDTO(saved);
    }

    public ContentPostDTO updateStatus(Long userId, Long postId, String status) {
        if (!VALID_STATUSES.contains(status.toUpperCase())) {
            throw new BadRequestException("Invalid status. Valid statuses: " + String.join(", ", VALID_STATUSES));
        }

        ContentPost post = contentPostRepository.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Content post not found"));

        if (!post.getUserId().equals(userId)) {
            throw new ResourceNotFoundException("Content post not found");
        }

        post.setStatus(status.toUpperCase());
        ContentPost updated = contentPostRepository.save(post);
        return toDTO(updated);
    }

    public List<ContentPostDTO> getUserContentPosts(Long userId) {
        return contentPostRepository.findByUserIdOrderByUpdatedAtDesc(userId)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    public List<ContentPostDTO> getScheduledPosts(Long userId, LocalDateTime start, LocalDateTime end) {
        return contentPostRepository.findByUserIdAndScheduledBetween(userId, start, end)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    public ContentPostDTO schedulePost(Long userId, Long postId, LocalDateTime scheduledAt) {
        ContentPost post = contentPostRepository.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Content post not found"));

        if (!post.getUserId().equals(userId)) {
            throw new ResourceNotFoundException("Content post not found");
        }

        post.setScheduledAt(scheduledAt);
        ContentPost updated = contentPostRepository.save(post);
        return toDTO(updated);
    }

    private ContentPostDTO toDTO(ContentPost post) {
        return new ContentPostDTO(post.getId(), post.getTitle(), post.getIdeaId(),
                post.getStatus(), post.getScheduledAt(), post.getUpdatedAt(), post.getCreatedAt());
    }
}
