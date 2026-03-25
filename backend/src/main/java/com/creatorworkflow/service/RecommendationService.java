package com.creatorworkflow.service;

import com.creatorworkflow.dto.RecommendationDTO;
import com.creatorworkflow.entity.ContentPost;
import com.creatorworkflow.entity.Idea;
import com.creatorworkflow.repository.ContentPostRepository;
import com.creatorworkflow.repository.IdeaRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class RecommendationService {

    private final IdeaRepository ideaRepository;
    private final ContentPostRepository contentPostRepository;

    public RecommendationService(IdeaRepository ideaRepository, ContentPostRepository contentPostRepository) {
        this.ideaRepository = ideaRepository;
        this.contentPostRepository = contentPostRepository;
    }

    public RecommendationDTO getRecommendation(Long userId) {
        RecommendationDTO recommendation = new RecommendationDTO();

        List<Idea> ideas = ideaRepository.findByUserIdOrderByCreatedAtDesc(userId);
        List<ContentPost> posts = contentPostRepository.findByUserIdOrderByUpdatedAtDesc(userId);

        // Calculate days since last post
        int daysSinceLastPost = calculateDaysSinceLastPost(posts);
        recommendation.setDaysSinceLastPost(daysSinceLastPost);

        // Determine urgency
        String urgency = determineUrgency(daysSinceLastPost);
        recommendation.setUrgency(urgency);

        // Analyze most used tags
        Map<String, Integer> tagFrequency = analyzeTagFrequency(ideas);
        List<String> topTags = tagFrequency.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .limit(3)
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());
        recommendation.setSuggestedTags(topTags);

        // Determine suggested content type
        String suggestedType = determineSuggestedContentType(ideas, posts, tagFrequency);
        recommendation.setSuggestedContentType(suggestedType);

        // Build recommendation message
        String message = buildRecommendationMessage(daysSinceLastPost, topTags, suggestedType, ideas.size(), posts.size());
        recommendation.setMessage(message);

        return recommendation;
    }

    private int calculateDaysSinceLastPost(List<ContentPost> posts) {
        Optional<ContentPost> lastPosted = posts.stream()
                .filter(p -> "POSTED".equals(p.getStatus()))
                .findFirst();

        if (lastPosted.isPresent()) {
            return (int) ChronoUnit.DAYS.between(lastPosted.get().getUpdatedAt(), LocalDateTime.now());
        }

        // If no posted content, check last activity
        if (!posts.isEmpty()) {
            return (int) ChronoUnit.DAYS.between(posts.get(0).getUpdatedAt(), LocalDateTime.now());
        }

        return -1; // No activity at all
    }

    private String determineUrgency(int daysSinceLastPost) {
        if (daysSinceLastPost < 0) return "GET_STARTED";
        if (daysSinceLastPost <= 1) return "ON_TRACK";
        if (daysSinceLastPost <= 3) return "MODERATE";
        if (daysSinceLastPost <= 7) return "HIGH";
        return "CRITICAL";
    }

    private Map<String, Integer> analyzeTagFrequency(List<Idea> ideas) {
        Map<String, Integer> tagFreq = new HashMap<>();

        for (Idea idea : ideas) {
            if (idea.getTags() != null && !idea.getTags().isBlank()) {
                String[] tags = idea.getTags().split(",");
                for (String tag : tags) {
                    String trimmedTag = tag.trim().toLowerCase();
                    if (!trimmedTag.isEmpty()) {
                        tagFreq.merge(trimmedTag, 1, Integer::sum);
                    }
                }
            }
        }

        return tagFreq;
    }

    private String determineSuggestedContentType(List<Idea> ideas, List<ContentPost> posts,
                                                  Map<String, Integer> tagFrequency) {
        // Find which content types have been underrepresented
        List<String> allTypes = Arrays.asList("YouTube", "Instagram", "Reels", "Blog", "Twitter", "LinkedIn");
        Set<String> usedTypes = new HashSet<>();

        for (Idea idea : ideas) {
            if (idea.getTags() != null) {
                for (String tag : idea.getTags().split(",")) {
                    usedTypes.add(tag.trim().toLowerCase());
                }
            }
        }

        // Find underrepresented types
        for (String type : allTypes) {
            if (!usedTypes.contains(type.toLowerCase())) {
                return type;
            }
        }

        // Fallback: suggest the most popular type
        if (!tagFrequency.isEmpty()) {
            return tagFrequency.entrySet().stream()
                    .max(Map.Entry.comparingByValue())
                    .map(e -> capitalize(e.getKey()))
                    .orElse("YouTube");
        }

        return "YouTube";
    }

    private String buildRecommendationMessage(int daysSinceLastPost, List<String> topTags,
                                               String suggestedType, int totalIdeas, int totalPosts) {
        StringBuilder message = new StringBuilder();

        if (daysSinceLastPost < 0) {
            message.append("🚀 Welcome! You haven't posted any content yet. ");
            message.append("Start by creating an idea and turning it into a script. ");
            if (totalIdeas > 0) {
                message.append("You have ").append(totalIdeas).append(" idea(s) ready to develop!");
            } else {
                message.append("Head to the Ideas page to brainstorm your first content!");
            }
        } else if (daysSinceLastPost <= 1) {
            message.append("🔥 Great momentum! You posted recently. ");
            message.append("Consider creating a ").append(suggestedType).append(" post next. ");
            if (!topTags.isEmpty()) {
                message.append("Your top themes are: ").append(String.join(", ", topTags)).append(".");
            }
        } else if (daysSinceLastPost <= 3) {
            message.append("📊 It's been ").append(daysSinceLastPost).append(" days since your last post. ");
            message.append("Try creating a ").append(suggestedType).append(" to maintain consistency. ");
            message.append("You have ").append(totalIdeas).append(" ideas and ").append(totalPosts).append(" content items.");
        } else if (daysSinceLastPost <= 7) {
            message.append("⚡ You haven't posted in ").append(daysSinceLastPost).append(" days. ");
            message.append("Consistency is key! A quick ").append(suggestedType).append(" post could re-engage your audience. ");
            if (!topTags.isEmpty()) {
                message.append("Focus on: ").append(topTags.get(0)).append(".");
            }
        } else {
            message.append("🚨 It's been ").append(daysSinceLastPost).append(" days since your last activity! ");
            message.append("Your audience misses you. Start with a simple ").append(suggestedType).append(" post ");
            message.append("and use the AI Script Builder to save time.");
        }

        return message.toString();
    }

    private String capitalize(String str) {
        if (str == null || str.isEmpty()) return str;
        return str.substring(0, 1).toUpperCase() + str.substring(1);
    }
}
