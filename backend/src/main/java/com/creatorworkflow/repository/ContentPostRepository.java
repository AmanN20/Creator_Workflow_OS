package com.creatorworkflow.repository;

import com.creatorworkflow.entity.ContentPost;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ContentPostRepository extends JpaRepository<ContentPost, Long> {
    List<ContentPost> findByUserIdOrderByUpdatedAtDesc(Long userId);

    List<ContentPost> findByIdeaId(Long ideaId);
    
    List<ContentPost> findByUserIdAndStatus(Long userId, String status);

    @Query("SELECT cp FROM ContentPost cp WHERE cp.userId = :userId AND " +
           "cp.scheduledAt BETWEEN :start AND :end ORDER BY cp.scheduledAt ASC")
    List<ContentPost> findByUserIdAndScheduledBetween(
            @Param("userId") Long userId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end);

    long countByUserId(Long userId);

    long countByUserIdAndStatus(Long userId, String status);

    @Query("SELECT cp FROM ContentPost cp WHERE cp.userId = :userId AND " +
           "cp.createdAt >= :since ORDER BY cp.createdAt DESC")
    List<ContentPost> findByUserIdAndCreatedAfter(
            @Param("userId") Long userId,
            @Param("since") LocalDateTime since);

    @Query("SELECT cp.status, COUNT(cp) FROM ContentPost cp WHERE cp.userId = :userId GROUP BY cp.status")
    List<Object[]> countByUserIdGroupByStatus(@Param("userId") Long userId);
}
