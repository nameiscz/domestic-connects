package com.domesticconnects.auth.repository;

import com.domesticconnects.auth.entity.PasswordResetToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {

    Optional<PasswordResetToken> findByTokenHash(String tokenHash);

    /**
     * Removes any outstanding tokens for a user — called before issuing a new
     * one so only the most recent reset link stays valid.
     */
    void deleteByUserId(Long userId);
}
