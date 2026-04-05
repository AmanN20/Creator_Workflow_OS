package com.creatorworkflow.service;

import com.creatorworkflow.dto.AnalyticsDTO;
import com.creatorworkflow.entity.ContentPost;
import com.creatorworkflow.entity.Idea;
import com.creatorworkflow.repository.ContentPostRepository;
import com.creatorworkflow.repository.IdeaRepository;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.TextStyle;
import java.util.*;

@Service
public class AnalyticsService {

    private final IdeaRepository ideaRepository;
    private final ContentPostRepository contentPostRepository;

    public AnalyticsService(IdeaRepository ideaRepository, ContentPostRepository contentPostRepository) {
        this.ideaRepository = ideaRepository;
        this.contentPostRepository = contentPostRepository;
    }

    public AnalyticsDTO getAnalytics(Long userId) {
        syncOldIdeasToContentPosts(userId);

        AnalyticsDTO analytics = new AnalyticsDTO();

        // Total counts
        analytics.setTotalIdeas(ideaRepository.countByUserId(userId));
        analytics.setTotalPosts(contentPostRepository.countByUserId(userId));
        analytics.setCompletedPosts(contentPostRepository.countByUserIdAndStatus(userId, "POSTED"));

        // Status breakdown
        Map<String, Long> statusBreakdown = new LinkedHashMap<>();
        statusBreakdown.put("IDEA", 0L);
        statusBreakdown.put("SCRIPT", 0L);
        statusBreakdown.put("RECORDED", 0L);
        statusBreakdown.put("EDITED", 0L);
        statusBreakdown.put("POSTED", 0L);

        List<Object[]> statusCounts = contentPostRepository.countByUserIdGroupByStatus(userId);
        for (Object[] row : statusCounts) {
            String status = (String) row[0];
            Long count = (Long) row[1];
            statusBreakdown.put(status, count);
        }
        analytics.setStatusBreakdown(statusBreakdown);

        // Weekly activity (last 7 days)
        Map<String, Long> weeklyActivity = new LinkedHashMap<>();
        LocalDate today = LocalDate.now();

        for (int i = 6; i >= 0; i--) {
            LocalDate date = today.minusDays(i);
            String dayName = date.getDayOfWeek().getDisplayName(TextStyle.SHORT, Locale.ENGLISH);
            LocalDateTime dayStart = date.atStartOfDay();
            LocalDateTime dayEnd = date.plusDays(1).atStartOfDay();

            List<ContentPost> dayPosts = contentPostRepository.findByUserIdAndScheduledBetween(userId, dayStart, dayEnd);
            weeklyActivity.put(dayName, (long) dayPosts.size());
        }

        // If no scheduled posts, fallback to created posts for weekly view
        boolean hasAnyActivity = weeklyActivity.values().stream().anyMatch(v -> v > 0);
        if (!hasAnyActivity) {
            weeklyActivity.clear();
            for (int i = 6; i >= 0; i--) {
                LocalDate date = today.minusDays(i);
                String dayName = date.getDayOfWeek().getDisplayName(TextStyle.SHORT, Locale.ENGLISH);
                LocalDateTime since = date.atStartOfDay();
                LocalDateTime until = date.plusDays(1).atStartOfDay();

                List<ContentPost> dayPosts = contentPostRepository.findByUserIdAndCreatedAfter(userId, since);
                long count = dayPosts.stream()
                        .filter(p -> p.getCreatedAt().isBefore(until))
                        .count();
                weeklyActivity.put(dayName, count);
            }
        }

        analytics.setWeeklyActivity(weeklyActivity);

        return analytics;
    }

    private void syncOldIdeasToContentPosts(Long userId) {
        List<Idea> allIdeas = ideaRepository.findByUserIdOrderByCreatedAtDesc(userId);
        List<ContentPost> existingPosts = contentPostRepository.findByUserIdOrderByUpdatedAtDesc(userId);

        for (Idea idea : allIdeas) {
            boolean hasPost = existingPosts.stream().anyMatch(p -> idea.getId().equals(p.getIdeaId()));
            if (!hasPost) {
                ContentPost post = new ContentPost();
                post.setUserId(userId);
                post.setIdeaId(idea.getId());
                post.setTitle(idea.getTitle());
                post.setStatus("IDEA");
                contentPostRepository.save(post);
            }
        }
    }
}
