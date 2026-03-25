package com.creatorworkflow.repository;

import com.creatorworkflow.entity.Idea;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface IdeaRepository extends JpaRepository<Idea, Long> {
    List<Idea> findByUserIdOrderByCreatedAtDesc(Long userId);

    @Query("SELECT i FROM Idea i WHERE i.userId = :userId AND " +
           "(LOWER(i.title) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(i.description) LIKE LOWER(CONCAT('%', :search, '%')))")
    List<Idea> searchByUserIdAndKeyword(@Param("userId") Long userId, @Param("search") String search);

    @Query("SELECT i FROM Idea i WHERE i.userId = :userId AND i.tags LIKE CONCAT('%', :tag, '%')")
    List<Idea> findByUserIdAndTag(@Param("userId") Long userId, @Param("tag") String tag);

    long countByUserId(Long userId);
}
