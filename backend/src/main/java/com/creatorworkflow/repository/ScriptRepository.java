package com.creatorworkflow.repository;

import com.creatorworkflow.entity.Script;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ScriptRepository extends JpaRepository<Script, Long> {
    List<Script> findByIdeaIdOrderByCreatedAtDesc(Long ideaId);

    @Modifying
    @Query("DELETE FROM Script s WHERE s.ideaId = :ideaId")
    void deleteByIdeaId(Long ideaId);
}
